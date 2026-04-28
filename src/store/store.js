"use client";

import { configureStore } from "@reduxjs/toolkit";
import metaReducer from "./slices/metaSlice";

export const makeStore = () =>
  configureStore({
    reducer: {
      meta: metaReducer,
    },
  });
