import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useSocket } from '../hooks/useSocket';
import { Send, Search, MessageSquare, ArrowLeft, Check, CheckCheck, X, Trash2 } from 'lucide-react';
import moment from 'moment';
import 'moment/locale/tr';

const API = import.meta.env.VITE_BASEURL;

const authedFetch = (url, token, opts = {}) =>
  fetch(`${API}${url}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opts.headers },
  }).then(r => r.json());

const Avatar = ({ user, size = 40, online = false }) => {
  const initials = user?.full_name?.charAt(0)?.toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || '?';
  return (
    <div className="relative flex-shrink-0">
      {user?.profile_picture
        ? <img src={user.profile_picture} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />
        : <div className="rounded-full flex items-center justify-center text-white font-bold bg-[var(--accent-primary)]" style={{ width: size, height: size, fontSize: size * 0.4 }}>{initials}</div>
      }
      {online && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[var(--bg-surface)] rounded-full" />}
    </div>
  );
};

const TypingDots = () => (
  <div className="flex items-center gap-1 px-3 py-2 rounded-2xl bg-[var(--bg-surface-light)] w-16">
    {[0, 1, 2].map(i => (
      <span key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
    ))}
  </div>
);

const WebMessages = () => {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const { socketRef, connected, onlineUsers, sendMessage: socketSend } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [connections, setConnections] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);
  const activeConvRef = useRef(null);
  const tokenRef = useRef(null);

  useEffect(() => { moment.locale(i18n.language.startsWith('tr') ? 'tr' : 'en'); }, [i18n.language]);
  useEffect(() => { activeConvRef.current = activeConv; }, [activeConv]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, partnerTyping]);

  useEffect(() => {
    if (!clerkUser) return;
    getToken().then(tok => { tokenRef.current = tok; loadConversations(tok); });
  }, [clerkUser]);

  // Socket listeners
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const onMsg = (msg) => {
      const partnerId = msg.from_user_id?._id || msg.from_user_id;
      if (activeConvRef.current?.partner?._id === partnerId) {
        setMessages(prev => [...prev, msg]);
        getToken().then(tok => authedFetch('/api/message/seen', tok, { method: 'POST', body: JSON.stringify({ from_user_id: partnerId }) }));
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
        setMessages(prev => {
          // Check if message is already in list (could happen if HTTP response came first)
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

    socket.on('message_received', onMsg);
    socket.on('message_sent', onSent);
    socket.on('typing_start', onTypStart);
    socket.on('typing_stop', onTypStop);
    socket.on('message_deleted', ({ messageId }) => {
      setMessages(prev => prev.filter(m => m._id !== messageId));
    });
    return () => {
      socket.off('message_received', onMsg);
      socket.off('message_sent', onSent);
      socket.off('typing_start', onTypStart);
      socket.off('typing_stop', onTypStop);
      socket.off('message_deleted');
    };
  }, [socketRef.current]);

  const loadConversations = async (token) => {
    try {
      const data = await authedFetch('/api/message/conversations', token);
      if (data.success) {
        setConversations(data.conversations.sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0)));
      }
      // Also fetch connections to start new chats
      const connData = await authedFetch('/api/user/connections', token);
      if (connData.success) {
        setConnections(connData.connections || []);
      }
    } finally { setLoadingConvs(false); }
  };

  const openConversation = async (conv) => {
    setActiveConv(conv);
    setMessages([]);
    setPartnerTyping(false);
    setLoadingMsgs(true);
    setConversations(prev => prev.map(c => c.partner?._id === conv.partner?._id ? { ...c, unreadCount: 0 } : c));
    try {
      const tok = tokenRef.current || await getToken();
      const data = await authedFetch('/api/message/get', tok, { method: 'POST', body: JSON.stringify({ to_user_id: conv.partner._id }) });
      if (data.success) setMessages(data.messages);
    } finally { setLoadingMsgs(false); }
  };

  const handleSend = useCallback(() => {
    if (!text.trim() || !activeConv) return;
    socketSend(activeConv.partner._id, text.trim());
    setText('');
    socketRef.current?.emit('typing_stop', { to_user_id: activeConv.partner._id });
  }, [text, activeConv, socketSend]);

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const handleTextChange = (val) => {
    setText(val);
    if (!activeConv) return;
    socketRef.current?.emit('typing_start', { to_user_id: activeConv.partner._id });
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => socketRef.current?.emit('typing_stop', { to_user_id: activeConv.partner._id }), 1500);
  };

  // Determine list of displayed chats/users
  // If searching, mix in connections that don't have a conversation yet
  const displayedConvs = React.useMemo(() => {
    if (!searchQuery) return conversations;

    const lowerQuery = searchQuery.toLowerCase();
    const filteredConvs = conversations.filter(c =>
      c.partner?.full_name?.toLowerCase().includes(lowerQuery) || c.partner?.username?.toLowerCase().includes(lowerQuery)
    );

    // Add connections that match search but aren't in conversations
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
    return fromId === clerkUser?.id || fromId !== activeConv?.partner?._id;
  };

  const handleDeleteMessage = async (msgId) => {
    if (window.confirm(t('messages.delete_confirm', 'Are you sure you want to delete this message?'))) {
      try {
        const tok = tokenRef.current || await getToken();
        const data = await authedFetch(`/api/message/delete/${msgId}`, tok, { method: 'DELETE' });
        if (data.success) {
          setMessages(prev => prev.filter(m => m._id !== msgId));
        } else {
          alert(data.message);
        }
      } catch (err) {
        alert(t('messages.delete_failed', 'Failed to delete message'));
      }
    }
  };

  return (
    <div className="flex h-full bg-[var(--bg-base)] overflow-hidden" style={{ minHeight: 0, flex: 1 }}>
      {/* Conversation List */}
      <div className={`${activeConv ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 border-r border-[var(--border-subtle)] flex-shrink-0`}>
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-extrabold text-[var(--text-primary)]">{t('messages.title', 'Messages')}</h1>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${connected ? 'bg-green-500/15 text-green-500' : 'bg-red-500/15 text-red-400'}`}>
              {connected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)]">
            <Search className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
            <input type="text" placeholder={t('messages.search', 'Search...')} value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none" />
            {searchQuery && <button onClick={() => setSearchQuery('')}><X className="w-3 h-3 text-[var(--text-muted)]" /></button>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="p-4 space-y-3">{Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-[var(--bg-surface-light)]" />
                <div className="flex-1 space-y-2"><div className="h-3 w-24 bg-[var(--bg-surface-light)] rounded" /><div className="h-2.5 w-36 bg-[var(--bg-surface-light)] rounded" /></div>
              </div>
            ))}</div>
          ) : displayedConvs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-center px-8">
              <MessageSquare className="w-10 h-10 text-[var(--border-subtle)]" />
              <p className="text-sm text-[var(--text-muted)]">{searchQuery ? t('messages.no_results', 'No users found') : t('messages.no_conversations', 'No conversations yet')}</p>
            </div>
          ) : displayedConvs.map(conv => {
            const isActive = activeConv?.partner?._id === conv.partner?._id;
            const isOnline = onlineUsers.has(conv.partner?._id);
            const hasUnread = conv.unreadCount > 0;
            return (
              <button key={conv.partner?._id} onClick={() => openConversation(conv)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${isActive ? 'bg-[var(--accent-primary)]/10 border-r-2 border-[var(--accent-primary)]' : 'hover:bg-[var(--bg-surface)]'}`}>
                <Avatar user={conv.partner} size={48} online={isOnline} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-sm ${hasUnread ? 'font-bold text-[var(--text-primary)]' : 'font-medium text-[var(--text-secondary)]'} truncate`}>
                      {conv.partner?.full_name || conv.partner?.username}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] flex-shrink-0 ml-2">{conv.lastMessage?.createdAt ? moment(conv.lastMessage.createdAt).fromNow() : ''}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={`text-xs truncate max-w-[180px] ${hasUnread ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-muted)]'}`}>
                      {conv.isNew ? t('messages.start_new_chat', 'Start a new chat') : (conv.lastMessage?.text || (conv.lastMessage?.message_type === 'image' ? '📷 Fotoğraf' : '...'))}
                    </p>
                    {hasUnread && <span className="ml-2 min-w-5 h-5 px-1.5 rounded-full bg-[var(--accent-primary)] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{conv.unreadCount}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      {activeConv ? (
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <button className="md:hidden p-1" onClick={() => setActiveConv(null)}>
              <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
            </button>
            <Avatar user={activeConv.partner} size={40} online={onlineUsers.has(activeConv.partner?._id)} />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-[var(--text-primary)] truncate">{activeConv.partner?.full_name || activeConv.partner?.username}</p>
              <p className="text-xs text-[var(--text-muted)]">{onlineUsers.has(activeConv.partner?._id) ? '● Online' : `@${activeConv.partner?.username}`}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-[var(--bg-base)]">
            {loadingMsgs ? (
              <div className="flex justify-center items-center h-full"><div className="w-7 h-7 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" /></div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                <MessageSquare className="w-10 h-10 text-[var(--border-subtle)]" />
                <p className="text-sm text-[var(--text-muted)]">{t('messages.start_conversation', 'Start the conversation!')}</p>
              </div>
            ) : messages.map((msg, idx) => {
              const mine = isMe(msg);
              return (
                <div key={msg._id || idx} className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                  {!mine && <div className="flex-shrink-0"><Avatar user={activeConv.partner} size={26} /></div>}
                  <div className="max-w-[70%]">
                    {msg.message_type === 'image' && msg.media_url && <img src={msg.media_url} alt="media" className="rounded-2xl mb-1 max-h-60 object-cover" />}
                    {msg.text && (
                      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${mine ? 'bg-[var(--accent-primary)] text-white rounded-br-sm' : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-bl-sm'}`}>
                        {msg.text}
                      </div>
                    )}
                    <div className={`flex items-center gap-1 mt-0.5 ${mine ? 'justify-end' : 'justify-start'}`}>
                      {mine && (
                        <button onClick={() => handleDeleteMessage(msg._id)} className="text-[var(--text-muted)] hover:text-red-500 mr-2 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <span className="text-[10px] text-[var(--text-muted)]">{moment(msg.createdAt).format('HH:mm')}</span>
                      {mine && (msg.seen ? <CheckCheck className="w-3 h-3 text-blue-400" /> : <Check className="w-3 h-3 text-[var(--text-muted)]" />)}
                    </div>
                  </div>
                </div>
              );
            })}
            {partnerTyping && <div className="flex items-end gap-2"><Avatar user={activeConv.partner} size={26} /><TypingDots /></div>}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-4 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <div className="flex items-end gap-2 px-4 py-2 rounded-2xl bg-[var(--bg-base)] border border-[var(--border-subtle)]">
              <textarea rows={1} placeholder={t('messages.type_message', 'Type a message...')}
                value={text} onChange={e => handleTextChange(e.target.value)} onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent resize-none text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none py-1.5 max-h-28" style={{ scrollbarWidth: 'none' }} />
              <button onClick={handleSend} disabled={!text.trim()}
                className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-all">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[var(--accent-primary)]/10 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-[var(--accent-primary)]" />
            </div>
            <p className="font-bold text-[var(--text-primary)]">{t('messages.select_conversation', 'Select a conversation')}</p>
            <p className="text-sm text-[var(--text-muted)] max-w-xs">{t('messages.select_hint', 'Choose from your conversations to start chatting.')}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebMessages;
