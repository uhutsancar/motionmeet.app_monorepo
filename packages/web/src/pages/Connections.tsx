import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ChatBubbleOutlineRounded from "@mui/icons-material/ChatBubbleOutlineRounded";
import { MapPin, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";
import axios from "axios";
import type { ApiFailure, PublicUser } from "@motionmeet/shared";
import {
  acceptConnection,
  acceptFollowRequest,
  declineFollowRequest,
  getConnections,
  getIncomingFollowRequests,
  unfollowUser,
} from "~/api/endpoints";
import { useAppDispatch } from "~/app/hooks";
import { EmptyState, PageHeader, PageShell } from "~/components/AppPage";
import { useAuthContext } from "~/context/AuthProvider";
import { fetchConnections } from "~/features/connections/connectionsSlice";
import { setRelationship } from "~/features/relationships/relationshipsSlice";

/**
 * `Requests` is the follow-request inbox; `Pending` is the older two-way
 * connection queue, which still exists alongside it.
 */
const TABS = [
  { key: "Requests", section: "followRequests", labelKey: "connections.requests", fallback: "Requests" },
  { key: "Followers", section: "followers", labelKey: "profile.followers", fallback: "Followers" },
  { key: "Following", section: "following", labelKey: "profile.following", fallback: "Following" },
  { key: "Pending", section: "pendingConnections", labelKey: "connections.pending", fallback: "Pending" },
  { key: "Connections", section: "connections", labelKey: "connections.title", fallback: "Connections" },
] as const;

type ConnectionTabKey = (typeof TABS)[number]["key"];
interface ConnectionPage { items: PublicUser[]; nextCursor: string | null; loaded: boolean; loading: boolean }
type ConnectionPages = Record<ConnectionTabKey, ConnectionPage>;

const createEmptyPages = (): ConnectionPages =>
  Object.fromEntries(
    TABS.map(({ key }): [ConnectionTabKey, ConnectionPage] => [
      key,
      { items: [], nextCursor: null, loaded: false, loading: false },
    ]),
  ) as ConnectionPages;

const errorMessage = (error: unknown, fallback: string): string => {
  const failure = axios.isAxiosError<ApiFailure>(error) ? error.response?.data : undefined;
  return failure?.message || (error instanceof Error ? error.message : fallback);
};

const Connections = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { getToken } = useAuthContext();
  const [searchParams, setSearchParams] = useSearchParams();

  // Opened straight on the followers/following list when the profile counters
  // are clicked, otherwise on the first tab.
  const requestedSection = searchParams.get("section");
  const [currentTab, setCurrentTab] = useState<ConnectionTabKey>(
    TABS.some((tab) => tab.key === requestedSection) ? (requestedSection as ConnectionTabKey) : TABS[0].key,
  );
  const [pages, setPages] = useState<ConnectionPages>(createEmptyPages);
  const [actionLoading, setActionLoading] = useState(false);
  const inFlightSectionsRef = useRef<Set<string>>(new Set());
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  const loadSection = useCallback(async (tabKey: ConnectionTabKey, { append = false }: { append?: boolean } = {}) => {
    const tab = TABS.find((item) => item.key === tabKey);
    if (!tab || inFlightSectionsRef.current.has(tab.section)) return;
    const cursor = append ? pagesRef.current[tabKey]?.nextCursor : null;
    if (append && !cursor) return;

    inFlightSectionsRef.current.add(tab.section);
    setPages((current) => ({ ...current, [tabKey]: { ...current[tabKey], loading: true } }));
    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication required");
      // Follow requests live on their own endpoint, which answers with
      // `{ user, createdAt }` rows rather than bare users.
      const data = tab.section === "followRequests"
        ? await getIncomingFollowRequests(token, cursor).then((page) => ({
            success: page.success,
            message: page.message,
            items: (page.items || []).map((entry) => entry.user),
            nextCursor: page.nextCursor,
          }))
        : await getConnections(token, tab.section, cursor);
      if (!data.success) throw new Error(data.message || "Connections could not be loaded");
      setPages((current) => {
        const previousItems = append ? current[tabKey].items : [];
        const knownIds = new Set(previousItems.map((user) => user?._id));
        const newItems = (data.items || []).filter((user) => user?._id && !knownIds.has(user._id));
        return {
          ...current,
          [tabKey]: {
            items: [...previousItems, ...newItems],
            nextCursor: data.nextCursor || null,
            loaded: true,
            loading: false,
          },
        };
      });
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Connections could not be loaded"));
      setPages((current) => ({ ...current, [tabKey]: { ...current[tabKey], loaded: true, loading: false } }));
    } finally {
      inFlightSectionsRef.current.delete(tab.section);
    }
  }, [getToken]);

  useEffect(() => {
    if (!pagesRef.current[currentTab].loaded) void loadSection(currentTab);
  }, [currentTab, loadSection, pages]);

  const selectTab = (tabKey: ConnectionTabKey) => {
    setCurrentTab(tabKey);
    // Keeps the tab shareable and survives a reload.
    setSearchParams(tabKey === TABS[0].key ? {} : { section: tabKey }, { replace: true });
  };

  const handleUnfollow = async (userId: string) => {
    setActionLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication required");
      const data = await unfollowUser(userId, token);
      if (!data.success) throw new Error(data.message);
      dispatch(setRelationship({ userId, relationship: data.relationship }));
      setPages((current) => ({
        ...current,
        Following: { ...current.Following, items: current.Following.items.filter((user) => user._id !== userId) },
      }));
      await dispatch(fetchConnections(token));
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Request failed"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptConnection = async (userId: string) => {
    setActionLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication required");
      const data = await acceptConnection(userId, token);
      if (!data.success) throw new Error(data.message);
      setPages((current) => ({
        ...current,
        Pending: { ...current.Pending, items: current.Pending.items.filter((user) => user._id !== userId) },
        Connections: { ...current.Connections, loaded: false },
      }));
      await dispatch(fetchConnections(token));
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Request failed"));
    } finally {
      setActionLoading(false);
    }
  };

  /** Approves or rejects an incoming follow request from the Requests tab. */
  const handleFollowRequest = async (userId: string, accept: boolean) => {
    setActionLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication required");
      const data = accept
        ? await acceptFollowRequest(userId, token)
        : await declineFollowRequest(userId, token);
      if (!data.success) throw new Error(data.message || "Request failed");
      dispatch(setRelationship({ userId, relationship: data.relationship }));
      // The row leaves Requests either way; accepting also adds a follower.
      setPages((current) => ({
        ...current,
        Requests: { ...current.Requests, items: current.Requests.items.filter((user) => user._id !== userId) },
        Followers: { ...current.Followers, loaded: false },
      }));
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Request failed"));
    } finally {
      setActionLoading(false);
    }
  };

  const currentPage = pages[currentTab];

  return (
    <PageShell maxWidth={860}>
      <PageHeader
        icon={Users}
        eyebrow={t("connections.eyebrow", "YOUR NETWORK")}
        title={t("connections.title", "Connections")}
        description={t("connections.description", "Follow requests, followers and the people you follow.")}
        action={(
          <Tooltip title={t("nearby.title", "Nearby")}>
            <Button variant="outlined" startIcon={<MapPin size={16} />} onClick={() => navigate("/nearby")}>
              {t("nearby.title", "Nearby")}
            </Button>
          </Tooltip>
        )}
      />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(5, 1fr)" }, gap: 1.5 }}>
        {TABS.map((tab) => (
          <Paper key={tab.key} variant="outlined" sx={{ p: 1.5, textAlign: "center", borderRadius: 2.5 }}>
            <Typography variant="h6" color="primary.main" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {pages[tab.key].loaded
                ? `${pages[tab.key].items.length}${pages[tab.key].nextCursor ? "+" : ""}`
                : "—"}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ fontWeight: 700 }}>
              {t(tab.labelKey, tab.fallback)}
            </Typography>
          </Paper>
        ))}
      </Box>

      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        <Tabs
          value={currentTab}
          onChange={(_, value: ConnectionTabKey) => selectTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: "divider" }}
        >
          {TABS.map((tab) => (
            <Tab key={tab.key} value={tab.key} label={t(tab.labelKey, tab.fallback)} sx={{ fontWeight: 700 }} />
          ))}
        </Tabs>

        {currentPage.loading && currentPage.items.length === 0 ? (
          <Stack sx={{ minHeight: 200, alignItems: "center", justifyContent: "center" }}>
            <CircularProgress size={26} />
          </Stack>
        ) : currentPage.items.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <EmptyState
              icon={Users}
              title={t("connections.empty", "Nobody here yet")}
              description={t("connections.empty_body", "People you follow and requests waiting for you appear on this page.")}
              minHeight={180}
            />
          </Box>
        ) : (
          currentPage.items.map((user) => (
            <Stack
              key={user._id}
              direction="row"
              spacing={1.5}
              sx={{ px: 2, py: 1.5, alignItems: "center", borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 } }}
            >
              <ButtonBase
                onClick={() => navigate(`/profile/${user._id}`)}
                sx={{ flex: 1, minWidth: 0, borderRadius: 2, justifyContent: "flex-start", textAlign: "left" }}
              >
                <Stack direction="row" spacing={1.5} sx={{ minWidth: 0, alignItems: "center" }}>
                  <Avatar src={user.profile_picture || undefined} alt={user.full_name} sx={{ width: 42, height: 42 }}>
                    {(user.full_name || user.username || "?").charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>{user.full_name}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>@{user.username}</Typography>
                  </Box>
                </Stack>
              </ButtonBase>

              {(currentTab === "Following" || currentTab === "Connections") && (
                <Tooltip title={t("common.message_action", "Send message")}>
                  <IconButton
                    aria-label={`${t("common.message_action", "Send message")}: ${user.username}`}
                    onClick={() => navigate(`/messages/${user._id}`)}
                  >
                    <ChatBubbleOutlineRounded fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {currentTab === "Requests" && (
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="contained" disabled={actionLoading} onClick={() => handleFollowRequest(user._id, true)}>
                    {t("activity.confirm", "Confirm")}
                  </Button>
                  <Button size="small" variant="outlined" color="inherit" disabled={actionLoading} onClick={() => handleFollowRequest(user._id, false)}>
                    {t("activity.decline", "Delete")}
                  </Button>
                </Stack>
              )}
              {currentTab === "Pending" && (
                <Button size="small" variant="contained" disabled={actionLoading} onClick={() => handleAcceptConnection(user._id)}>
                  {t("connections.accept", "Accept")}
                </Button>
              )}
              {currentTab === "Following" && (
                <Button size="small" color="inherit" disabled={actionLoading} onClick={() => handleUnfollow(user._id)}>
                  {t("connections.unfollow", "Unfollow")}
                </Button>
              )}
            </Stack>
          ))
        )}

        {currentPage.nextCursor && (
          <Stack sx={{ p: 2, alignItems: "center" }}>
            <Button
              variant="outlined"
              disabled={currentPage.loading}
              startIcon={currentPage.loading ? <CircularProgress size={14} /> : null}
              onClick={() => loadSection(currentTab, { append: true })}
            >
              {t("common.load_more", "Load more")}
            </Button>
          </Stack>
        )}
      </Paper>

      <Chip
        variant="outlined"
        label={t("connections.privacy_hint", "Private accounts approve each follower before their posts become visible.")}
        sx={{ alignSelf: "center", height: "auto", py: 0.75, "& .MuiChip-label": { whiteSpace: "normal", textAlign: "center" } }}
      />
    </PageShell>
  );
};

export default Connections;
