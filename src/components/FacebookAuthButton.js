"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { setAccessToken } from "@/store/slices/metaSlice";
import { apiAuthFacebookLogin } from "@/lib/api";

export default function FacebookAuthButton({ text = "Connect Facebook", onSuccess, onTriggerReady, className = "" }) {
  const dispatch = useDispatch();
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    // If we already have FB loaded, no need to inject again
    if (window.FB) {
      setIsSdkLoaded(true);
      return;
    }

    // Inject Meta JS SDK
    window.fbAsyncInit = function () {
      window.FB.init({
        appId: process.env.NEXT_PUBLIC_FB_APP_ID || "872763128868354", // Fallback for dummy usage
        cookie: true,
        xfbml: true,
        version: "v20.0",
      });
      setIsSdkLoaded(true);
    };

    (function (d, s, id) {
      var js,
        fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) return;
      js = d.createElement(s);
      js.id = id;
      js.src = "https://connect.facebook.net/en_US/sdk.js";
      fjs.parentNode.insertBefore(js, fjs);
    })(document, "script", "facebook-jssdk");
  }, []);

  const handleLogin = useCallback(() => {
    if (!window.FB) return;
    setIsLoggingIn(true);
    
    // We are requesting permissions to read page insights and publish if needed
    window.FB.login(
      (response) => {
        if (response.authResponse) {
          const processLogin = async () => {
            try {
              const shortLivedToken = response.authResponse.accessToken;
              const res = await apiAuthFacebookLogin({ accessToken: shortLivedToken });
              const longLivedToken = res?.accessToken || shortLivedToken;
              const partnerId = res?.partner?.id || res?.partner?.partner_id || null;

              // Long-lived tokens last about 60 days
              const expiry = new Date().getTime() + 60 * 24 * 60 * 60 * 1000;
              let existingPageTokens = {};
              try {
                const existing = JSON.parse(localStorage.getItem('fb_token_data'));
                if (existing && existing.pageTokens) existingPageTokens = existing.pageTokens;
              } catch(e) {}
              localStorage.setItem('fb_token_data', JSON.stringify({ token: longLivedToken, expiry, pageTokens: existingPageTokens, partnerId }));
              dispatch(setAccessToken({
                accessToken: longLivedToken,
                partnerId,
                partner: res?.partner,
                queuedPages: res?.queuedPages,
              }));
              if (onSuccess) onSuccess(longLivedToken);
            } catch (error) {
              console.error("Failed to sync auth with backend:", error);
            } finally {
              setIsLoggingIn(false);
            }
          };
          processLogin();
        } else {
          setIsLoggingIn(false);
          console.error("User cancelled login or did not fully authorize.");
          // For demo purposes if user cancels we can fallback or dispatch an error
          // e.g. dispatch(setAccessToken('dummy_access_token_demo_mode'));
        }
      },
      { scope: 'pages_show_list,pages_read_engagement,pages_read_user_content' }
    );
  }, [dispatch, onSuccess]);

  useEffect(() => {
    if (!onTriggerReady) {
      return;
    }

    onTriggerReady(isSdkLoaded && !isLoggingIn ? () => handleLogin : null);

    return () => onTriggerReady(null);
  }, [handleLogin, isLoggingIn, isSdkLoaded, onTriggerReady]);

  return (
    <button
      onClick={handleLogin}
      disabled={!isSdkLoaded || isLoggingIn}
      className={`flex items-center gap-2 bg-[#1877F2] hover:bg-[#166FE5] text-white px-5 py-2.5 rounded-lg font-medium transition-colors ${(!isSdkLoaded || isLoggingIn) ? 'opacity-70 cursor-not-allowed' : ''} ${className}`}
      style={{
        boxShadow: "0px 4px 6px -4px rgba(24, 119, 242, 0.2), 0px 10px 15px -3px rgba(24, 119, 242, 0.2)",
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
      <span>{isLoggingIn ? "Connecting..." : text}</span>
    </button>
  );
}
