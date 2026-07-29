import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from "../context/AuthProvider";
import { useSocket } from '../hooks/useSocket';
import { Send, Search, MessageSquare, ArrowLeft, Check, CheckCheck, X, Trash2 } from 'lucide-react';
import moment from 'moment';
import 'moment/locale/tr';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AvatarMui from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import Badge from '@mui/material/Badge';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import { CONTENT_LIMITS, createOperationId } from '@motionmeet/shared';

import { getConversations, getMessages, markSeen, deleteMessage } from '../services/messageService';
import { getConnections } from '../services/userService';

const Avatar = ({ user, size = 40, online = false }) => {
  const initials = user?.full_name?.charAt(0)?.toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || '?';
  return (
    <Badge
      overlap="circular"
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      variant="dot"
      invisible={!online}
      sx={{ '& .MuiBadge-badge': { backgroundColor: '#4ade80', color: '#4ade80', boxShadow: '0 0 0 2px var(--mui-palette-background-paper)' } }}
    >
      <AvatarMui src={user?.profile_picture} sx={{ width: size, height: size, bgcolor: 'primary.main', fontSize: size * 0.4, fontWeight: 'bold' }}>
        {!user?.profile_picture && initials}
      </AvatarMui>
    </Badge>
  );
};

const TypingDots = () => (
  <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", px: 1.5, py: 1, borderRadius: 3, bgcolor: 'action.hover', width: 'fit-content' }}>
    {[0, 1, 2].map(i => (
      <Box key={i} sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'text.secondary', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: `${i * 0.15}s`, '@keyframes bounce': { '0%, 80%, 100%': { transform: 'scale(0)' }, '40%': { transform: 'scale(1)' } } }} />
    ))}
  </Stack>
);

const WebMessages = () => {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuthContext();
  const { user: currentUser } = useAuthContext();
  const { userId: requestedUserId } = useParams();
  const navigate = useNavigate();
  const { socket, socketRef, connected, onlineUsers, sendMessage: socketSend } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [connections, setConnections] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMoreConvs, setLoadingMoreConvs] = useState(false);
  const [conversationCursor, setConversationCursor] = useState(null);
  const [connectionCursor, setConnectionCursor] = useState(null);
  const [loadingMoreConnections, setLoadingMoreConnections] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);
  const activeConvRef = useRef(null);
  const pendingDraftRef = useRef('');
  const skipAutoScrollRef = useRef(false);
  const conversationRequestRef = useRef(0);
  const typingActiveRef = useRef(false);
  const sendTimeoutRef = useRef(null);
  const pendingOperationIdRef = useRef(null);

  const loadConversations = useCallback(async (
    token,
    { cursor = null, append = false } = {},
  ) => {
    if (append) setLoadingMoreConvs(true);
    else setLoadingConvs(true);
    try {
      const [data, connData] = await Promise.all([
        getConversations(token, cursor),
        append ? Promise.resolve(null) : getConnections(token, 'connections'),
      ]);
      if (data.success) {
        setConversations((current) => {
          const incoming = data.conversations || [];
          if (!append) return incoming;
          const knownIds = new Set(current.map((item) => item.conversationId));
          return [
            ...current,
            ...incoming.filter((item) => !knownIds.has(item.conversationId)),
          ];
        });
        setConversationCursor(data.nextCursor || null);
      }
      if (connData?.success) {
        setConnections(connData.items || []);
        setConnectionCursor(connData.nextCursor || null);
      }
    } catch (error) {
      toast.error(error.message || 'Conversations could not be loaded');
    } finally {
      if (append) setLoadingMoreConvs(false);
      else setLoadingConvs(false);
    }
  }, []);

  const loadMoreConversations = useCallback(async () => {
    if (!conversationCursor || loadingMoreConvs) return;
    const token = await getToken();
    if (token) {
      await loadConversations(token, {
        cursor: conversationCursor,
        append: true,
      });
    }
  }, [conversationCursor, getToken, loadConversations, loadingMoreConvs]);

  const loadMoreConnections = useCallback(async () => {
    if (!connectionCursor || loadingMoreConnections) return;
    setLoadingMoreConnections(true);
    try {
      const token = await getToken();
      if (!token) return;
      const data = await getConnections(token, 'connections', connectionCursor);
      if (data.success) {
        setConnections((current) => {
          const knownIds = new Set(current.map((connection) => connection._id));
          return [
            ...current,
            ...(data.items || []).filter((connection) => !knownIds.has(connection._id)),
          ];
        });
        setConnectionCursor(data.nextCursor || null);
      }
    } catch (error) {
      toast.error(error.message || 'Connections could not be loaded');
    } finally {
      setLoadingMoreConnections(false);
    }
  }, [connectionCursor, getToken, loadingMoreConnections]);

  const openConversation = useCallback(async (conv) => {
    if (!conv?.partner?._id) return;
    if (typingActiveRef.current && activeConvRef.current?.partner?._id) {
      socketRef.current?.emit('typing_stop', {
        to_user_id: activeConvRef.current.partner._id,
      });
      typingActiveRef.current = false;
    }
    pendingOperationIdRef.current = null;
    setActiveConv(conv);
    setMessages([]);
    setNextCursor(null);
    setPartnerTyping(false);
    setLoadingMsgs(true);
    const requestId = ++conversationRequestRef.current;
    setConversations(prev => prev.map(c => c.partner?._id === conv.partner?._id ? { ...c, unreadCount: 0 } : c));
    try {
      const token = await getToken();
      const data = await getMessages(token, conv.partner._id);
      if (conversationRequestRef.current === requestId && data.success) {
        setMessages(data.messages || []);
        setNextCursor(data.nextCursor);
      }
    } catch (error) {
      if (conversationRequestRef.current === requestId) {
        toast.error(error.message || 'Messages could not be loaded');
      }
    } finally {
      if (conversationRequestRef.current === requestId) setLoadingMsgs(false);
    }
  }, [getToken, socketRef]);

  useEffect(() => {
    moment.locale(i18n.language.startsWith('tr') ? 'tr' : 'en');
  }, [i18n.language]);

  useEffect(() => {
    activeConvRef.current = activeConv;
  }, [activeConv]);

  useEffect(() => {
    if (skipAutoScrollRef.current) {
      skipAutoScrollRef.current = false;
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partnerTyping]);

  const loadOlderMessages = useCallback(async () => {
    if (!activeConv?.partner?._id || !nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const token = await getToken();
      const data = await getMessages(
        token,
        activeConv.partner._id,
        nextCursor,
      );
      if (data.success) {
        skipAutoScrollRef.current = true;
        setMessages((currentMessages) => {
          const knownIds = new Set(currentMessages.map((message) => message._id));
          return [
            ...(data.messages || []).filter((message) => !knownIds.has(message._id)),
            ...currentMessages,
          ];
        });
        setNextCursor(data.nextCursor);
      }
    } catch (error) {
      toast.error(error.message || 'Messages could not be loaded');
    } finally {
      setLoadingOlder(false);
    }
  }, [activeConv, getToken, loadingOlder, nextCursor]);

  useEffect(() => {
    return () => {
      clearTimeout(typingTimerRef.current);
      clearTimeout(sendTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    getToken().then(token => {
      if (!token) return;
      loadConversations(token);
    }).catch((error) => toast.error(error.message || 'Authentication failed'));
  }, [currentUser, getToken, loadConversations]);

  useEffect(() => {
    if (!requestedUserId) {
      setActiveConv(null);
      return;
    }
    if (loadingConvs || activeConv?.partner?._id === requestedUserId) return;
    const conversation = conversations.find(item => item.partner?._id === requestedUserId);
    const connection = connections.find(item => item._id === requestedUserId);
    const target = conversation || (connection ? { partner: connection, lastMessage: null, unreadCount: 0, isNew: true } : null);
    if (target) openConversation(target);
  }, [activeConv, connections, conversations, loadingConvs, openConversation, requestedUserId]);

  useEffect(() => {
    if (!socket) return;

    const onMsg = (msg) => {
      const partnerId = msg.from_user_id?._id || msg.from_user_id;
      if (activeConvRef.current?.partner?._id === partnerId) {
        setMessages(prev => prev.some(item => item._id === msg._id) ? prev : [...prev, msg]);
        getToken()
          .then((token) => token && markSeen(token, partnerId))
          .catch(() => undefined);
      }
      setConversations(prev => {
        const exists = prev.some(c => c.partner?._id === partnerId);
        let updated = [];
        if (exists) {
          updated = prev.map(c => c.partner?._id === partnerId ? { ...c, lastMessage: msg, unreadCount: activeConvRef.current?.partner?._id === partnerId ? 0 : (c.unreadCount || 0) + 1 } : c);
        } else {
          updated = [{ partner: msg.from_user_id, lastMessage: msg, unreadCount: activeConvRef.current?.partner?._id === partnerId ? 0 : 1 }, ...prev];
        }
        return updated.sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));
      });
    };

    const onSent = (msg) => {
      const partnerId = msg.to_user_id?._id || msg.to_user_id;
      if (activeConvRef.current?.partner?._id === partnerId) {
        clearTimeout(sendTimeoutRef.current);
        pendingDraftRef.current = '';
        pendingOperationIdRef.current = null;
        setSending(false);
        setMessages(prev => {
          if (!prev.some(m => m._id === msg._id)) {
            return [...prev, msg];
          }
          return prev;
        });
      }
      setConversations(prev => {
        const partnerInfo = activeConvRef.current?.partner?._id === partnerId ? activeConvRef.current.partner : msg.to_user_id;
        const exists = prev.some(c => c.partner?._id === partnerId);
        let updated = [];
        if (exists) {
          updated = prev.map(c => c.partner?._id === partnerId ? { ...c, lastMessage: msg } : c);
        } else {
          updated = [{ partner: partnerInfo, lastMessage: msg, unreadCount: 0 }, ...prev];
        }
        return updated.sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));
      });
    };

    const onTypStart = ({ from_user_id }) => { if (activeConvRef.current?.partner?._id === from_user_id) setPartnerTyping(true); };
    const onTypStop = ({ from_user_id }) => { if (activeConvRef.current?.partner?._id === from_user_id) setPartnerTyping(false); };
    const restorePendingDraft = ({ message, operationId } = {}) => {
      if (
        operationId &&
        operationId !== pendingOperationIdRef.current
      ) return;
      clearTimeout(sendTimeoutRef.current);
      setText((current) => current || pendingDraftRef.current);
      pendingDraftRef.current = '';
      setSending(false);
      if (message) toast.error(message);
    };

    socket.on('message_received', onMsg);
    socket.on('message_sent', onSent);
    socket.on('typing_start', onTypStart);
    socket.on('typing_stop', onTypStop);
    socket.on('message_error', restorePendingDraft);
    socket.on('disconnect', restorePendingDraft);
    const onSeen = ({ by_user_id: byUserId } = {}) => {
      if (activeConvRef.current?.partner?._id !== byUserId) return;
      setMessages((current) => current.map((message) => {
        const toId = message.to_user_id?._id || message.to_user_id;
        return toId === byUserId ? { ...message, seen: true } : message;
      }));
    };
    socket.on('messages_seen', onSeen);
    const onDeleted = ({ messageId }) => {
      setMessages(prev => prev.filter(m => m._id !== messageId));
    };
    socket.on('message_deleted', onDeleted);
    return () => {
      socket.off('message_received', onMsg);
      socket.off('message_sent', onSent);
      socket.off('typing_start', onTypStart);
      socket.off('typing_stop', onTypStop);
      socket.off('message_error', restorePendingDraft);
      socket.off('disconnect', restorePendingDraft);
      socket.off('messages_seen', onSeen);
      socket.off('message_deleted', onDeleted);
    };
  }, [getToken, socket]);

  const handleSend = useCallback(() => {
    if (!text.trim() || !activeConv || sending) return;
    const draft = text.trim();
    pendingOperationIdRef.current ||= createOperationId('message');
    const sent = socketSend(
      activeConv.partner._id,
      draft,
      pendingOperationIdRef.current,
    );
    if (!sent) return;
    pendingDraftRef.current = draft;
    setSending(true);
    setText('');
    typingActiveRef.current = false;
    clearTimeout(sendTimeoutRef.current);
    sendTimeoutRef.current = setTimeout(() => {
      setText((current) => current || pendingDraftRef.current);
      pendingDraftRef.current = '';
      setSending(false);
      toast.error(t('messages.send_failed', 'Message could not be sent. Please retry.'));
    }, 15_000);
    socketRef.current?.emit('typing_stop', { to_user_id: activeConv.partner._id });
  }, [text, activeConv, sending, socketRef, socketSend, t]);

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const handleTextChange = (val) => {
    setText(val);
    pendingOperationIdRef.current = null;
    if (!activeConv) return;
    if (val.trim() && !typingActiveRef.current) {
      typingActiveRef.current = true;
      socketRef.current?.emit('typing_start', { to_user_id: activeConv.partner._id });
    }
    if (!val.trim() && typingActiveRef.current) {
      typingActiveRef.current = false;
      socketRef.current?.emit('typing_stop', { to_user_id: activeConv.partner._id });
    }
    clearTimeout(typingTimerRef.current);
    if (val.trim()) {
      typingTimerRef.current = setTimeout(() => {
        typingActiveRef.current = false;
        socketRef.current?.emit('typing_stop', { to_user_id: activeConv.partner._id });
      }, 1500);
    }
  };

  const displayedConvs = React.useMemo(() => {
    if (!searchQuery) return conversations;

    const lowerQuery = searchQuery.toLowerCase();
    const filteredConvs = conversations.filter(c =>
      c.partner?.full_name?.toLowerCase().includes(lowerQuery) || c.partner?.username?.toLowerCase().includes(lowerQuery)
    );

    const convPartnerIds = new Set(conversations.map(c => c.partner?._id));
    const matchingConnections = connections.filter(conn =>
      !convPartnerIds.has(conn._id) &&
      (conn.full_name?.toLowerCase().includes(lowerQuery) || conn.username?.toLowerCase().includes(lowerQuery))
    );

    const connConvs = matchingConnections.map(conn => ({
      partner: conn,
      lastMessage: null,
      unreadCount: 0,
      isNew: true
    }));

    return [...filteredConvs, ...connConvs];
  }, [conversations, connections, searchQuery]);

  const isMe = (msg) => {
    const fromId = msg.from_user_id?._id || msg.from_user_id;
    return fromId === currentUser?.id;
  };

  const handleDeleteMessage = async (msgId) => {
    if (window.confirm(t('messages.delete_confirm', 'Are you sure you want to delete this message?'))) {
      try {
        const tok = await getToken();
        const data = await deleteMessage(tok, msgId);
        if (data.success) {
          setMessages(prev => prev.filter(m => m._id !== msgId));
        } else {
          alert(data.message);
        }
      } catch {
        alert(t('messages.delete_failed', 'Failed to delete message'));
      }
    }
  };

  return (
    <Box sx={{ height: '100%', p: { xs: 0, md: 3 }, minHeight: 0 }}>
      <Paper
        variant="outlined"
        sx={{
          display: 'flex',
          height: '100%',
          maxWidth: 1200,
          mx: 'auto',
          bgcolor: 'background.paper',
          overflow: 'hidden',
          borderRadius: { xs: 0, md: 3.5 },
        }}
      >
      <Box sx={{ display: { xs: activeConv ? 'none' : 'flex', md: 'flex' }, flexDirection: 'column', width: { xs: '100%', md: 336, lg: 360 }, borderRight: 1, borderColor: 'divider', flexShrink: 0, bgcolor: 'background.paper' }}>
        <Box sx={{ px: 2.5, py: 2.25, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" sx={{ justifyContent: "space-between",  alignItems: "center" }} mb={2}>
            <Typography variant="h6" fontWeight={800}>{t('messages.title', 'Messages')}</Typography>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: connected ? 'success.main' : 'error.main' }} />
              <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ fontSize: 10 }}>{connected ? 'LIVE' : 'OFFLINE'}</Typography>
            </Stack>
          </Stack>
          <TextField
            variant="outlined"
            size="small"
            fullWidth
            placeholder={t('messages.search', 'Search...')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment>,
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchQuery('')}><X size={14} /></IconButton>
                  </InputAdornment>
                ) : null,
                sx: { borderRadius: 2.5, bgcolor: 'background.default' }
              }
            }}
          />
        </Box>
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {loadingConvs ? (
            <Stack p={2} spacing={1.5}>
              {Array(5).fill(0).map((_, i) => (
                <Stack key={i} direction="row" spacing={2} p={1}>
                  <Box sx={{ borderRadius: '50%', bgcolor: 'action.hover', width: 48, height: 48 }} />
                  <Stack flex={1} spacing={1} sx={{ justifyContent: "center" }}>
                    <Box sx={{ height: 12, width: 96, bgcolor: 'action.hover', borderRadius: 1 }} />
                    <Box sx={{ height: 10, width: 144, bgcolor: 'action.hover', borderRadius: 1 }} />
                  </Stack>
                </Stack>
              ))}
            </Stack>
          ) : displayedConvs.length === 0 && !(searchQuery && connectionCursor) ? (
            <Stack height={220} spacing={1.25} px={4} sx={{ justifyContent: "center",  alignItems: "center", textAlign: "center" }}>
              <Box sx={{ width: 42, height: 42, borderRadius: 2.5, bgcolor: 'action.hover', display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
                <MessageSquare size={20} />
              </Box>
              <Typography variant="subtitle2" fontWeight={800}>{searchQuery ? t('messages.no_results', 'No users found') : t('messages.no_conversations', 'No conversations yet')}</Typography>
              <Typography variant="caption" color="text.secondary">{searchQuery ? 'Try a different name or username.' : 'Your conversations will appear here.'}</Typography>
            </Stack>
          ) : (
            <List disablePadding>
              {displayedConvs.map(conv => {
                const isActive = activeConv?.partner?._id === conv.partner?._id;
                const isOnline = onlineUsers.has(conv.partner?._id);
                const hasUnread = conv.unreadCount > 0;
                return (
                  <ListItemButton key={conv.partner?._id} onClick={() => navigate(`/messages/${conv.partner?._id}`)} selected={isActive} sx={{ px: 2.5, py: 1.5, borderRight: isActive ? 2 : 0, borderColor: 'primary.main', bgcolor: isActive ? 'action.selected' : 'transparent' }}>
                    <ListItemAvatar>
                      <Avatar user={conv.partner} size={48} online={isOnline} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Stack direction="row" sx={{ justifyContent: "space-between",  alignItems: "center" }} mb={0.5}>
                          <Typography variant="body2" fontWeight={hasUnread ? 700 : 500} noWrap>{conv.partner?.full_name || conv.partner?.username}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, ml: 1, flexShrink: 0 }}>{conv.lastMessage?.createdAt ? moment(conv.lastMessage.createdAt).fromNow() : ''}</Typography>
                        </Stack>
                      }
                      secondary={
                        <Stack direction="row" sx={{ justifyContent: "space-between",  alignItems: "center" }}>
                          <Typography variant="caption" noWrap sx={{ maxWidth: 180, color: hasUnread ? 'text.primary' : 'text.secondary', fontWeight: hasUnread ? 500 : 400 }}>
                            {conv.isNew ? t('messages.start_new_chat', 'Start a new chat') : (conv.lastMessage?.text || (conv.lastMessage?.message_type === 'image' ? '📷 Fotoğraf' : '...'))}
                          </Typography>
                          {hasUnread && <Box sx={{ minWidth: 20, height: 20, px: 0.75, borderRadius: 10, bgcolor: 'primary.main', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, ml: 1, flexShrink: 0 }}>{conv.unreadCount}</Box>}
                        </Stack>
                      }
                      disableTypography
                    />
                  </ListItemButton>
                );
              })}
              {!searchQuery && conversationCursor && (
                <Button
                  fullWidth
                  size="small"
                  onClick={loadMoreConversations}
                  disabled={loadingMoreConvs}
                  startIcon={loadingMoreConvs ? <CircularProgress size={14} /> : null}
                  sx={{ my: 1 }}
                >
                  {t('common.load_more', 'Load more')}
                </Button>
              )}
              {searchQuery && connectionCursor && (
                <Button
                  fullWidth
                  size="small"
                  onClick={loadMoreConnections}
                  disabled={loadingMoreConnections}
                  startIcon={loadingMoreConnections ? <CircularProgress size={14} /> : null}
                  sx={{ my: 1 }}
                >
                  {t('messages.search_more_connections', 'Search more connections')}
                </Button>
              )}
            </List>
          )}
        </Box>
      </Box>

      {activeConv ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, bgcolor: 'background.default' }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: "center", px: 2.5, py: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            <IconButton sx={{ display: { xs: 'flex', md: 'none' } }} onClick={() => navigate('/messages')} size="small">
              <ArrowLeft size={20} />
            </IconButton>
            <Avatar user={activeConv.partner} size={40} online={onlineUsers.has(activeConv.partner?._id)} />
            <Box flex={1} minWidth={0}>
              <Typography variant="subtitle2" fontWeight={700} noWrap>{activeConv.partner?.full_name || activeConv.partner?.username}</Typography>
              <Typography variant="caption" color="text.secondary">{onlineUsers.has(activeConv.partner?._id) ? '● Online' : `@${activeConv.partner?.username}`}</Typography>
            </Box>
          </Stack>

          <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 1.5, sm: 3 }, py: 2.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {nextCursor && !loadingMsgs && (
              <Button
                size="small"
                onClick={loadOlderMessages}
                disabled={loadingOlder}
                startIcon={loadingOlder ? <CircularProgress size={14} /> : null}
                sx={{ alignSelf: 'center' }}
              >
                {t('common.load_more', 'Load older messages')}
              </Button>
            )}
            {loadingMsgs ? (
              <Stack sx={{ justifyContent: "center",  alignItems: "center" }} height="100%">
                <CircularProgress size={28} />
              </Stack>
            ) : messages.length === 0 ? (
              <Stack height="100%" spacing={1} sx={{ justifyContent: "center",  alignItems: "center", textAlign: "center" }}>
                <MessageSquare size={40} color="var(--mui-palette-text-disabled)" />
                <Typography variant="body2" color="text.secondary">{t('messages.start_conversation', 'Start the conversation!')}</Typography>
              </Stack>
            ) : messages.map((msg, idx) => {
              const mine = isMe(msg);
              return (
                <Stack key={msg._id || idx} direction="row" sx={{ justifyContent: mine ? 'flex-end' : 'flex-start',  alignItems: "flex-end" }} spacing={1}>
                  {!mine && <Avatar user={activeConv.partner} size={26} />}
                  <Box sx={{ maxWidth: '70%' }}>
                    {msg.message_type === 'image' && msg.media_url && <Box component="img" src={msg.media_url} alt="media" sx={{ borderRadius: 3, mb: 0.5, maxHeight: 240, objectFit: 'cover' }} />}
                    {msg.text && (
                      <Paper elevation={0} sx={{ px: 1.75, py: 1.1, borderRadius: 2.5, bgcolor: mine ? 'primary.main' : 'background.paper', color: mine ? 'primary.contrastText' : 'text.primary', border: !mine ? 1 : 0, borderColor: 'divider' }}>
                        <Typography variant="body2" sx={{ lineHeight: 1.5, wordBreak: 'break-word' }}>{msg.text}</Typography>
                      </Paper>
                    )}
                    <Stack direction="row" sx={{ justifyContent: mine ? 'flex-end' : 'flex-start',  alignItems: "center" }} spacing={0.5} mt={0.5}>
                      {mine && (
                        <IconButton size="small" onClick={() => handleDeleteMessage(msg._id)} sx={{ p: 0.25, mr: 0.5, color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
                          <Trash2 size={14} />
                        </IconButton>
                      )}
                      <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary' }}>{moment(msg.createdAt).format('HH:mm')}</Typography>
                      {mine && (msg.seen ? <CheckCheck size={12} color="#60a5fa" /> : <Check size={12} color="var(--mui-palette-text-disabled)" />)}
                    </Stack>
                  </Box>
                </Stack>
              );
            })}
            {partnerTyping && <Stack direction="row" sx={{ alignItems: "flex-end" }} spacing={1}><Avatar user={activeConv.partner} size={26} /><TypingDots /></Stack>}
            <Box ref={messagesEndRef} />
          </Box>

          <Box sx={{ px: 2, py: 1.5, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "flex-end", px: 1.5, py: 0.75, borderRadius: 2.5, bgcolor: 'background.default', border: 1, borderColor: 'divider' }}>
              <TextField
                multiline
                maxRows={4}
                placeholder={t('messages.type_message', 'Type a message...')}
                  value={text}
                  onChange={e => handleTextChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sending}
                  slotProps={{
                    htmlInput: { maxLength: CONTENT_LIMITS.message },
                    input: { disableUnderline: true, sx: { fontSize: 14, py: 0.5 } },
                  }}
                  variant="standard"
                  fullWidth
                  sx={{ flex: 1 }}
              />
              <IconButton
                onClick={handleSend}
                disabled={!text.trim() || !connected || sending}
                sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' }, width: 36, height: 36, borderRadius: 3, flexShrink: 0 }}
              >
                <Send size={16} />
              </IconButton>
            </Stack>
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: { xs: 'none', md: 'flex' }, flex: 1, alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', p: 4 }}>
          <Stack spacing={1.5} sx={{ alignItems: "center", textAlign: "center" }}>
            <Box sx={{ borderRadius: 3, bgcolor: 'action.hover', color: 'primary.main', display: 'grid', placeItems: 'center', width: 52, height: 52, border: 1, borderColor: 'divider' }}>
              <MessageSquare size={24} />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>{t('messages.select_conversation', 'Select a conversation')}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 260 }}>{t('messages.select_hint', 'Choose from your conversations to start chatting.')}</Typography>
            </Box>
          </Stack>
        </Box>
      )}
      </Paper>
    </Box>
  );
};

export default WebMessages;
