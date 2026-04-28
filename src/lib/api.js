import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api/v1";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

const unwrap = (response) => response?.data?.data ?? response?.data ?? null;

export const getApiErrorMessage = (error, fallback = "Something went wrong.") => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.response?.data?.error || error.message || fallback;
  }

  return error instanceof Error ? error.message : fallback;
};

export const apiAuthFacebookLogin = async ({ accessToken }) => {
  const response = await apiClient.post("/facebook/connect", { accessToken });
  return unwrap(response);
};

export const apiGetUserProfile = async ({ accessToken }) => {
  const response = await apiClient.post("/insights/user", {
    access_token: accessToken,
    fields: "id,name,email,picture",
  });
  return unwrap(response);
};

export const apiGetPartnerByUserId = async (userId) => {
  const response = await apiClient.get(`/partners/user/${userId}`);
  return unwrap(response);
};

export const apiGetPartnerPages = async (partnerId) => {
  const response = await apiClient.get(`/pages/partner/${partnerId}`);
  return unwrap(response) || [];
};

export const apiGetPageInsights = async ({ pageId, since, until }) => {
  const response = await apiClient.get(`/page-insights/${pageId}/${since}/${until}`);
  return unwrap(response);
};

export const apiGetMultiplePageInsights = async ({ pageIds, since, until }) => {
  const response = await apiClient.post(`/page-insights/batch/${since}/${until}`, {
    pageIds,
  });
  return unwrap(response) || [];
};

export const apiGetPagePosts = async (pageId) => {
  const response = await apiClient.get(`/posts/page/${pageId}`);
  return unwrap(response) || [];
};

export const apiGetPost = async (postId) => {
  const response = await apiClient.get(`/posts/${postId}`);
  return unwrap(response);
};

export const apiGetPostInsights = async ({ postId, since, until }) => {
  const response = await apiClient.get(`/post-insights/${postId}/${since}/${until}`);
  return unwrap(response);
};

export const apiGetMultiplePostInsights = async ({ postIds, since, until }) => {
  const response = await apiClient.post(`/post-insights/batch/${since}/${until}`, {
    postIds,
  });
  return unwrap(response) || [];
};

export const apiGetPostCommentsCount = async ({ postId, accessToken }) => {
  const response = await apiClient.post(`/insights/posts/${postId}/comments-count`, {
    access_token: accessToken,
  });
  return unwrap(response);
};

export const apiGetPostSharesCount = async ({ postId, accessToken }) => {
  const response = await apiClient.post(`/insights/posts/${postId}/shares-count`, {
    access_token: accessToken,
  });
  return unwrap(response);
};

export { API_BASE_URL };
