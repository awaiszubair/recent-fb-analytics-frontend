"use client";

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  apiGetMultiplePageInsights,
  apiGetMultiplePostInsights,
  apiGetPageInsights,
  apiGetPagePosts,
  apiGetPartnerByUserId,
  apiGetPartnerPages,
  apiGetPost,
  apiGetPostCommentsCount,
  apiGetPostInsights,
  apiGetPostSharesCount,
  apiGetUserProfile,
  getApiErrorMessage,
} from "@/lib/api";

const SESSION_STORAGE_KEY = "fb_token_data";
const DEFAULT_PAGE_CATEGORY = "Media / News";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const ACCOUNT_PAGE_METRICS = [
  "content_monetization_earnings",
  "monetization_approximate_earnings",
  "page_impressions_unique",
  "page_post_engagements",
  "page_media_view",
  "page_follows",
  "page_video_views",
];

const POST_INSIGHT_METRICS = [
  "content_monetization_earnings",
  "monetization_approximate_earnings",
  "post_impressions_unique",
  "post_media_view",
  "post_impressions_organic_unique",
  "post_impressions_paid_unique",
  "post_reactions_by_type_total",
  "post_clicks_by_type",
  "post_video_views",
  "post_video_views_10s",
  "post_video_avg_time_watched",
  "post_video_retention_graph",
];

const EARNINGS_METRICS = new Set([
  "content_monetization_earnings",
  "monetization_approximate_earnings",
]);

const parseDecimalLike = (value) => {
  if (!value || typeof value !== "object" || !Array.isArray(value.d) || typeof value.e !== "number") {
    return null;
  }

  const chunks = value.d.map((chunk, index) => {
    const chunkString = String(Math.trunc(Number(chunk) || 0));
    return index === 0 ? chunkString : chunkString.padStart(7, "0");
  });

  const digits = chunks.join("");
  const decimalIndex = value.e + 1;
  let normalized = digits;

  if (decimalIndex <= 0) {
    normalized = `0.${"0".repeat(Math.abs(decimalIndex))}${digits}`;
  } else if (decimalIndex < digits.length) {
    normalized = `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
  } else if (decimalIndex > digits.length) {
    normalized = `${digits}${"0".repeat(decimalIndex - digits.length)}`;
  }

  const sign = value.s === -1 ? "-" : "";
  const parsed = Number(`${sign}${normalized}`);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseNumericLike = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const decimalLike = parseDecimalLike(value);
  if (decimalLike !== null) {
    return decimalLike;
  }

  return 0;
};

const safeParse = (value) => {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const readStoredSession = () => {
  if (typeof window === "undefined") {
    return { token: null, partnerId: null };
  }

  const parsed = safeParse(window.localStorage.getItem(SESSION_STORAGE_KEY));

  if (!parsed?.token) {
    return { token: null, partnerId: null };
  }

  if (parsed.expiry && Number(parsed.expiry) <= Date.now()) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return { token: null, partnerId: null };
  }

  return {
    token: parsed.token,
    partnerId: parsed.partnerId || null,
  };
};

const writeStoredSession = ({ token, partnerId }) => {
  if (typeof window === "undefined" || !token) {
    return;
  }

  const existing = safeParse(window.localStorage.getItem(SESSION_STORAGE_KEY)) || {};

  window.localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      ...existing,
      token,
      partnerId: partnerId || existing.partnerId || null,
      expiry: existing.expiry || Date.now() + 60 * 24 * 60 * 60 * 1000,
      pageTokens: existing.pageTokens || {},
    })
  );
};

const clearStoredSession = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SESSION_STORAGE_KEY);
};

const todayString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const shiftDateString = (dateStr, days) => {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const resolveWindow = ({ since, until } = {}, defaultDays = 7) => {
  if (since && until) {
    return { since, until };
  }

  const untilDate = todayString();
  return {
    since: shiftDateString(untilDate, -defaultDays),
    until: untilDate,
  };
};

const getPreviousWindow = ({ since, until }) => {
  const start = new Date(`${since}T00:00:00`);
  const end = new Date(`${until}T00:00:00`);
  const diffDays = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
  const previousEnd = shiftDateString(since, -1);
  const previousStart = shiftDateString(since, -diffDays - 1);

  return {
    since: previousStart,
    until: previousEnd,
  };
};

const normalizeUserProfile = (profile) => ({
  id: profile?.fb_user_id || profile?.id || null,
  name: profile?.name || null,
  email: profile?.email || null,
  picture: profile?.picture_url || profile?.picture?.data?.url || null,
});

const normalizePartner = (partner) => ({
  partnerId: partner?.partner_id || partner?.id || partner?.fb_user_id || null,
  userId: partner?.user_id || null,
  name: partner?.name || null,
  email: partner?.email || null,
});

const inferAttachmentType = (statusType = "") => {
  const value = String(statusType).toLowerCase();

  if (value.includes("video")) return "video_inline";
  if (value.includes("reel") || value.includes("story")) return "reel";
  if (value.includes("photo") || value.includes("image")) return "photo";
  if (value.includes("link") || value.includes("share")) return "share";

  return null;
};

const buildSyntheticAttachments = (statusType) => {
  const type = inferAttachmentType(statusType);
  return type ? { data: [{ type }] } : undefined;
};

const normalizeMetricValue = (metricName, value) => {
  if (EARNINGS_METRICS.has(metricName) && value && typeof value === "object") {
    const microAmount = parseNumericLike(value.microAmount);
    return Number.isFinite(microAmount) ? microAmount / 1_000_000 : 0;
  }

  return value;
};

const toNumber = (value) => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return 0;
};

const normalizePageRecord = (page, insights) => {
  const pageInsights = insights || { data: [] };

  return {
    id: page?.fb_page_id || page?.id || null,
    name: page?.page_name || page?.name || "Untitled Page",
    category: page?.category || null,
    picture: page?.picture_url || page?.picture || null,
    followers: toNumber(page?.fan_count ?? page?.followers),
    insights: pageInsights,
    metrics: buildMetricTotals(pageInsights),
    last_synced_at: page?.last_synced_at || null,
    latest_sync_completed_at: page?.latest_sync_completed_at || null,
  };
};

const normalizePostRecord = (post, insights) => {
  const statusType = post?.status_type || post?.type || "";

  return {
    id: post?.fb_post_id || post?.id || null,
    fb_post_id: post?.fb_post_id || post?.id || null,
    message: post?.message || "",
    status_type: statusType,
    type: post?.type || statusType || null,
    permalink_url: post?.permalink || post?.permalink_url || null,
    created_time: post?.created_time || null,
    attachments: post?.attachments || (post?.full_picture ? { data: [{ media: { image: { src: post.full_picture } }, type: inferAttachmentType(statusType) }] } : buildSyntheticAttachments(statusType)),
    comments: { comments_count: post?.comments_count || 0 },
    shares: { shares_count: post?.shares_count || 0 },
    insights: insights || { data: [] },
  };
};

const normalizeQueuedPages = (queuedPages = []) =>
  queuedPages
    .filter((page) => page?.fbPageId)
    .map((page) => ({
      id: page.fbPageId,
      name: page.pageName || "Queued Page",
      category: DEFAULT_PAGE_CATEGORY,
      picture: null,
      followers: 0,
      metrics: {},
      last_synced_at: null,
    }));

const buildInsightsPayload = (rows = []) => {
  const metricMap = new Map();

  rows.forEach((row) => {
    const metricName = row?.metric_name || row?.name;

    if (!metricName) {
      return;
    }

    if (!metricMap.has(metricName)) {
      metricMap.set(metricName, {
        name: metricName,
        period: row?.period || "day",
        values: [],
      });
    }

    metricMap.get(metricName).values.push({
      value: normalizeMetricValue(metricName, row?.metric_value ?? row?.value ?? 0),
      end_time: row?.end_time || null,
    });
  });

  return {
    data: Array.from(metricMap.values()).map((metric) => ({
      ...metric,
      values: metric.values.sort((a, b) => (a.end_time || "").localeCompare(b.end_time || "")),
    })),
  };
};

const sumMetricValue = (value) => {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return parseNumericLike(value);
  }

  if (value && typeof value === "object") {
    if ("microAmount" in value) {
      return parseNumericLike(value.microAmount) / 1_000_000;
    }

    return Object.values(value).reduce((total, current) => total + parseNumericLike(current), 0);
  }

  return 0;
};

const buildMetricTotals = (insights) =>
  (insights?.data || []).reduce((totals, metric) => {
    totals[metric.name] = (metric.values || []).reduce((sum, entry) => sum + sumMetricValue(entry?.value), 0);
    return totals;
  }, {});

const aggregatePageTotals = (pages = []) =>
  pages.reduce((totals, page) => {
    Object.entries(page?.metrics || {}).forEach(([metricName, value]) => {
      totals[metricName] = (totals[metricName] || 0) + (typeof value === "number" ? value : 0);
    });

    return totals;
  }, {});

const buildBatchInsightMap = (results = [], keyName) => {
  const insightMap = new Map();

  results.forEach((item) => {
    const entityId = item?.[keyName];

    if (entityId) {
      insightMap.set(entityId, buildInsightsPayload(item?.data || []));
    }
  });

  return insightMap;
};

/**
 * Aggregates time-series data across multiple pages for a specific metric.
 * This is used for the network-wide chart on the main dashboard.
 */
const aggregateTimeSeries = (pages = [], metricNames) => {
  const names = Array.isArray(metricNames) ? metricNames : [metricNames];
  const dateMap = new Map();

  pages.forEach((page) => {
    names.forEach((metricName) => {
      const metric = page.insights?.data?.find((m) => m.name === metricName);
      if (!metric || !Array.isArray(metric.values)) return;

      metric.values.forEach((v) => {
        if (!v.end_time) return;
        const day = v.end_time.substring(0, 10);
        const val = sumMetricValue(v.value);
        dateMap.set(day, (dateMap.get(day) || 0) + val);
      });
    });
  });

  return Array.from(dateMap.entries())
    .map(([date, value]) => ({
      date,
      value,
      name: new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short" }),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

const isPostInsideWindow = (post, since, until) => {
  if (!post?.created_time) {
    return true;
  }

  const createdDate = post.created_time.slice(0, 10);
  return createdDate >= since && createdDate <= until;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchPartnerPagesWithRetry = async (partnerId, attempts = 4) => {
  for (let index = 0; index < attempts; index += 1) {
    const pages = await apiGetPartnerPages(partnerId);

    if (pages.length > 0 || index === attempts - 1) {
      return pages;
    }

    await wait(1500);
  }

  return [];
};

const ensurePartnerContext = async (accessToken, statePartnerId) => {
  const storedSession = readStoredSession();
  let partnerId = statePartnerId || storedSession.partnerId || null;
  let userProfile = null;

  if (!partnerId && accessToken) {
    const profile = normalizeUserProfile(await apiGetUserProfile({ accessToken }));
    userProfile = profile;

    if (profile.id) {
      const partner = normalizePartner(await apiGetPartnerByUserId(profile.id));
      partnerId = partner.partnerId;
    }
  }

  if (accessToken && partnerId) {
    writeStoredSession({ token: accessToken, partnerId });
  }

  return { partnerId, userProfile };
};

const storedSession = readStoredSession();

const initialState = {
  userAccessToken: storedSession.token,
  partnerId: storedSession.partnerId,
  isConnected: Boolean(storedSession.token),
  userProfile: null,
  accountData: null,
  pagesCache: {},
  postsCache: {},
  loading: {
    account: false,
    accountPages: false,
    userProfile: false,
    page: false,
    post: false,
  },
  error: null,
};

export const fetchUserProfile = createAsyncThunk(
  "meta/fetchUserProfile",
  async ({ accessToken } = {}, thunkApi) => {
    try {
      const state = thunkApi.getState().meta;
      const token = accessToken || state.userAccessToken;

      if (!token) {
        throw new Error("Facebook access token is missing.");
      }

      const profile = normalizeUserProfile(await apiGetUserProfile({ accessToken: token }));
      let partnerId = state.partnerId || readStoredSession().partnerId || null;

      if (!partnerId && profile.id) {
        const partner = normalizePartner(await apiGetPartnerByUserId(profile.id));
        partnerId = partner.partnerId;
      }

      writeStoredSession({ token, partnerId });

      return { profile, partnerId };
    } catch (error) {
      return thunkApi.rejectWithValue(getApiErrorMessage(error, "Failed to fetch user profile."));
    }
  }
);

export const fetchAccountPagesOnly = createAsyncThunk(
  "meta/fetchAccountPagesOnly",
  async ({ accessToken } = {}, thunkApi) => {
    try {
      const state = thunkApi.getState().meta;
      const token = accessToken || state.userAccessToken;
      const { partnerId, userProfile } = await ensurePartnerContext(token, state.partnerId);

      if (!partnerId) {
        throw new Error("No synced Facebook partner was found for this account.");
      }

      const pages = (await fetchPartnerPagesWithRetry(partnerId)).map((page) => normalizePageRecord(page));

      return { partnerId, userProfile, pages };
    } catch (error) {
      return thunkApi.rejectWithValue(getApiErrorMessage(error, "Failed to fetch connected pages."));
    }
  }
);

export const fetchAccountData = createAsyncThunk(
  "meta/fetchAccountData",
  async ({ accessToken, since, until, includePrevious = false } = {}, thunkApi) => {
    try {
      const state = thunkApi.getState().meta;
      const token = accessToken || state.userAccessToken;

      if (!token) {
        throw new Error("Facebook access token is missing.");
      }

      const { partnerId, userProfile } = await ensurePartnerContext(token, state.partnerId);

      if (!partnerId) {
        throw new Error("No synced Facebook partner was found for this account.");
      }

      const window = resolveWindow({ since, until }, 30);
      const pagesResponse = await fetchPartnerPagesWithRetry(partnerId);
      const basePages = pagesResponse.map((page) => normalizePageRecord(page));

      if (basePages.length === 0) {
        return {
          partnerId,
          userProfile,
          pages: state.accountData?.pages || [],
          previousPages: [],
          totals: {},
          previousTotals: {},
          since: window.since,
          until: window.until,
        };
      }

      const pageIds = basePages.map((page) => page.id).filter(Boolean);
      const currentResults = await apiGetMultiplePageInsights({
        pageIds,
        since: window.since,
        until: window.until,
      });
      const currentInsightMap = buildBatchInsightMap(currentResults, "pageId");
      const pages = basePages.map((page) => normalizePageRecord(page, currentInsightMap.get(page.id)));
      const totals = aggregatePageTotals(pages);

      const chartData = aggregateTimeSeries(pages, "content_monetization_earnings");

      let previousPages = [];
      let previousTotals = {};

      if (includePrevious) {
        const previousWindow = getPreviousWindow(window);
        const previousResults = await apiGetMultiplePageInsights({
          pageIds,
          since: previousWindow.since,
          until: previousWindow.until,
        });
        const previousInsightMap = buildBatchInsightMap(previousResults, "pageId");
        previousPages = basePages.map((page) => normalizePageRecord(page, previousInsightMap.get(page.id)));
        previousTotals = aggregatePageTotals(previousPages);
      }

      return {
        partnerId,
        userProfile,
        pages,
        previousPages,
        totals,
        previousTotals,
        chartData,
        since: window.since,
        until: window.until,
      };
    } catch (error) {
      return thunkApi.rejectWithValue(getApiErrorMessage(error, "Failed to fetch dashboard data."));
    }
  }
);

export const fetchPageInsightsOnly = createAsyncThunk(
  "meta/fetchPageInsightsOnly",
  async ({ pageId, since, until } = {}, thunkApi) => {
    try {
      const state = thunkApi.getState().meta;
      const token = state.userAccessToken;

      if (!token) {
        throw new Error("Facebook access token is missing.");
      }

      const window = resolveWindow({ since, until }, 30);
      const response = await apiGetPageInsights({
        pageId,
        since: window.since,
        until: window.until,
      });

      return {
        pageId,
        insights: buildInsightsPayload(response?.data || []),
      };
    } catch (error) {
      return thunkApi.rejectWithValue(getApiErrorMessage(error, "Failed to fetch page insights."));
    }
  }
);

export const fetchPagePostsOnly = createAsyncThunk(
  "meta/fetchPagePostsOnly",
  async ({ pageId, since, until } = {}, thunkApi) => {
    try {
      const state = thunkApi.getState().meta;
      const token = state.userAccessToken;

      if (!token) {
        throw new Error("Facebook access token is missing.");
      }

      const window = resolveWindow({ since, until }, 30);
      const postsResponse = await apiGetPagePosts(pageId, {
        since: window.since,
        until: window.until,
      });
      const filteredPosts = postsResponse
        .map((post) => normalizePostRecord(post))
        .filter((post) => isPostInsideWindow(post, window.since, window.until))
        .sort((a, b) => new Date(b.created_time || 0).getTime() - new Date(a.created_time || 0).getTime());

      if (filteredPosts.length === 0) {
        return {
          pageId,
          posts: [],
        };
      }

      const postIds = filteredPosts.map((post) => post.id).filter(Boolean);
      const insightsResponse = await apiGetMultiplePostInsights({
        postIds,
        since: window.since,
        until: window.until,
      });
      const insightMap = buildBatchInsightMap(insightsResponse, "postId");
      const posts = filteredPosts.map((post) => normalizePostRecord(post, insightMap.get(post.id)));

      return { pageId, posts };
    } catch (error) {
      return thunkApi.rejectWithValue(getApiErrorMessage(error, "Failed to fetch page posts."));
    }
  }
);

export const fetchPostMetadataOnly = createAsyncThunk(
  "meta/fetchPostMetadataOnly",
  async ({ postId } = {}, thunkApi) => {
    try {
      const post = normalizePostRecord(await apiGetPost(postId));
      return { postId, metadata: post };
    } catch (error) {
      return thunkApi.rejectWithValue(getApiErrorMessage(error, "Failed to fetch post metadata."));
    }
  }
);

export const fetchPostInsightsOnly = createAsyncThunk(
  "meta/fetchPostInsightsOnly",
  async ({ postId, since, until } = {}, thunkApi) => {
    try {
      const state = thunkApi.getState().meta;
      const token = state.userAccessToken;

      if (!token) {
        throw new Error("Facebook access token is missing.");
      }

      const window = resolveWindow({ since, until }, 90);
      const [insightsResponse, commentsResponse, sharesResponse] = await Promise.all([
        apiGetPostInsights({
          postId,
          since: window.since,
          until: window.until,
        }),
        apiGetPostCommentsCount({ postId, accessToken: token }).catch(() => ({ metric_value: 0 })),
        apiGetPostSharesCount({ postId, accessToken: token }).catch(() => ({ metric_value: 0 })),
      ]);

      return {
        postId,
        insights: buildInsightsPayload(insightsResponse?.data || []),
        comments: {
          comments_count: toNumber(commentsResponse?.metric_value),
        },
        shares: {
          shares_count: toNumber(sharesResponse?.metric_value),
        },
      };
    } catch (error) {
      return thunkApi.rejectWithValue(getApiErrorMessage(error, "Failed to fetch post insights."));
    }
  }
);

export const fetchPageDetails = ({ pageId, since, until } = {}) => async (dispatch) => {
  await Promise.all([
    dispatch(fetchPageInsightsOnly({ pageId, since, until })),
    dispatch(fetchPagePostsOnly({ pageId, since, until })),
  ]);
};

const metaSlice = createSlice({
  name: "meta",
  initialState,
  reducers: {
    setAccessToken: (state, action) => {
      const payload = typeof action.payload === "string" ? { accessToken: action.payload } : action.payload || {};
      const token = payload.accessToken || null;
      const partner = normalizePartner(payload.partner || {});
      const partnerId = payload.partnerId || partner.partnerId || state.partnerId || null;
      const queuedPages = normalizeQueuedPages(payload.queuedPages);

      state.userAccessToken = token;
      state.partnerId = partnerId;
      state.isConnected = Boolean(token);
      state.error = null;

      if (queuedPages.length > 0 && !state.accountData?.pages?.length) {
        state.accountData = {
          ...(state.accountData || {}),
          pages: queuedPages,
          previousPages: [],
          totals: {},
          previousTotals: {},
        };
      }

      if (token) {
        writeStoredSession({ token, partnerId });
      }
    },
    resetAccountData: (state) => {
      state.accountData = null;
    },
    clearPageCache: (state, action) => {
      if (!action.payload) {
        state.pagesCache = {};
        return;
      }

      delete state.pagesCache[action.payload];
    },
    logoutFacebook: (state) => {
      state.userAccessToken = null;
      state.partnerId = null;
      state.isConnected = false;
      state.userProfile = null;
      state.accountData = null;
      state.pagesCache = {};
      state.postsCache = {};
      state.loading = {
        account: false,
        accountPages: false,
        userProfile: false,
        page: false,
        post: false,
      };
      state.error = null;

      clearStoredSession();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserProfile.pending, (state) => {
        state.loading.userProfile = true;
        state.error = null;
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.loading.userProfile = false;
        state.userProfile = action.payload.profile;
        state.partnerId = action.payload.partnerId || state.partnerId;
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.loading.userProfile = false;
        state.error = action.payload || action.error.message || null;
      })
      .addCase(fetchAccountPagesOnly.pending, (state) => {
        state.loading.accountPages = true;
        state.error = null;
      })
      .addCase(fetchAccountPagesOnly.fulfilled, (state, action) => {
        state.loading.accountPages = false;
        state.partnerId = action.payload.partnerId || state.partnerId;

        if (action.payload.userProfile && !state.userProfile) {
          state.userProfile = action.payload.userProfile;
        }

        if (action.payload.pages.length > 0) {
          const existingPages = new Map((state.accountData?.pages || []).map((page) => [page.id, page]));
          const mergedPages = action.payload.pages.map((page) => ({
            ...(existingPages.get(page.id) || {}),
            ...page,
            metrics: (existingPages.get(page.id) || {}).metrics || page.metrics,
            insights: (existingPages.get(page.id) || {}).insights || page.insights,
          }));

          state.accountData = {
            ...(state.accountData || {}),
            pages: mergedPages,
            previousPages: state.accountData?.previousPages || [],
            totals: state.accountData?.totals || {},
            previousTotals: state.accountData?.previousTotals || {},
            chartData: state.accountData?.chartData || [],
          };
        }
      })
      .addCase(fetchAccountPagesOnly.rejected, (state, action) => {
        state.loading.accountPages = false;
        state.error = action.payload || action.error.message || null;
      })
      .addCase(fetchAccountData.pending, (state) => {
        state.loading.account = true;
        state.error = null;
      })
      .addCase(fetchAccountData.fulfilled, (state, action) => {
        state.loading.account = false;
        state.partnerId = action.payload.partnerId || state.partnerId;

        if (action.payload.userProfile && !state.userProfile) {
          state.userProfile = action.payload.userProfile;
        }

        state.accountData = {
          pages: action.payload.pages,
          previousPages: action.payload.previousPages,
          totals: action.payload.totals,
          previousTotals: action.payload.previousTotals,
          chartData: action.payload.chartData || [],
          since: action.payload.since,
          until: action.payload.until,
        };
      })
      .addCase(fetchAccountData.rejected, (state, action) => {
        state.loading.account = false;
        state.error = action.payload || action.error.message || null;
      })
      .addCase(fetchPageInsightsOnly.pending, (state) => {
        state.loading.page = true;
        state.error = null;
      })
      .addCase(fetchPageInsightsOnly.fulfilled, (state, action) => {
        state.loading.page = false;
        state.pagesCache[action.payload.pageId] = {
          ...(state.pagesCache[action.payload.pageId] || {}),
          insights: action.payload.insights,
        };
      })
      .addCase(fetchPageInsightsOnly.rejected, (state, action) => {
        state.loading.page = false;
        state.error = action.payload || action.error.message || null;
      })
      .addCase(fetchPagePostsOnly.pending, (state) => {
        state.loading.page = true;
        state.error = null;
      })
      .addCase(fetchPagePostsOnly.fulfilled, (state, action) => {
        state.loading.page = false;
        state.pagesCache[action.payload.pageId] = {
          ...(state.pagesCache[action.payload.pageId] || {}),
          posts: {
            data: action.payload.posts,
          },
        };

        action.payload.posts.forEach((post) => {
          state.postsCache[post.id] = {
            ...(state.postsCache[post.id] || {}),
            metadata: post,
            insights: post.insights,
          };
        });
      })
      .addCase(fetchPagePostsOnly.rejected, (state, action) => {
        state.loading.page = false;
        state.error = action.payload || action.error.message || null;
      })
      .addCase(fetchPostMetadataOnly.pending, (state) => {
        state.loading.post = true;
        state.error = null;
      })
      .addCase(fetchPostMetadataOnly.fulfilled, (state, action) => {
        state.loading.post = false;
        const existing = state.postsCache[action.payload.postId] || {};
        state.postsCache[action.payload.postId] = {
          ...existing,
          metadata: action.payload.metadata,
          comments: existing.comments?.comments_count > 0 ? existing.comments : action.payload.metadata.comments,
          shares: existing.shares?.shares_count > 0 ? existing.shares : action.payload.metadata.shares,
        };
      })
      .addCase(fetchPostMetadataOnly.rejected, (state, action) => {
        state.loading.post = false;
        state.error = action.payload || action.error.message || null;
      })
      .addCase(fetchPostInsightsOnly.pending, (state) => {
        state.loading.post = true;
        state.error = null;
      })
      .addCase(fetchPostInsightsOnly.fulfilled, (state, action) => {
        state.loading.post = false;
        const existing = state.postsCache[action.payload.postId] || {};
        state.postsCache[action.payload.postId] = {
          ...existing,
          insights: action.payload.insights,
          comments: action.payload.comments?.comments_count > 0 ? action.payload.comments : (existing.comments || action.payload.comments),
          shares: action.payload.shares?.shares_count > 0 ? action.payload.shares : (existing.shares || action.payload.shares),
        };
      })
      .addCase(fetchPostInsightsOnly.rejected, (state, action) => {
        state.loading.post = false;
        state.error = action.payload || action.error.message || null;
      });
  },
});

export const { setAccessToken, resetAccountData, clearPageCache, logoutFacebook } = metaSlice.actions;
export default metaSlice.reducer;
