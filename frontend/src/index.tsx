// frontend/src/index.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import App from "./App";
import web3Theme from "./theme";
import { btms } from "./btmsClient";
import { BTMS } from "btms-core";

// eslint-disable-next-line no-console
console.log("[index.tsx] bundle loaded (react 18 createRoot)");

// ---- global BTMS fail-soft patch ----
(function patchBTMS() {
  const makeSafeListAssets = (original: (...args: any[]) => Promise<any>) => {
    return async function safeListAssets(this: any, ...args: any[]) {
      try {
        return await original.apply(this, args);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          "btms.listAssets failed (likely LARS / desktop / wallet not running). Returning empty list.",
          err,
        );
        return [];
      }
    };
  };

  const anyBtms = btms as any;
  if (anyBtms && typeof anyBtms.listAssets === "function") {
    if (!anyBtms.__safeListAssets) {
      anyBtms.listAssets = makeSafeListAssets(anyBtms.listAssets);
      anyBtms.__safeListAssets = true;
    }
  }

  const AnyBTMS = BTMS as any;
  if (
    AnyBTMS &&
    AnyBTMS.prototype &&
    typeof AnyBTMS.prototype.listAssets === "function"
  ) {
    if (!AnyBTMS.prototype.__safeListAssets) {
      AnyBTMS.prototype.listAssets = makeSafeListAssets(
        AnyBTMS.prototype.listAssets,
      );
      AnyBTMS.prototype.__safeListAssets = true;
    }
  }
})();
// ---- end patch ----

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("#root not found in DOM");
}

const root = createRoot(rootEl);

const renderApp = (Component: React.ComponentType) => {
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <ThemeProvider theme={web3Theme}>
          <CssBaseline />
          <ToastContainer
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
          />
          <Component />
        </ThemeProvider>
      </BrowserRouter>
    </React.StrictMode>,
  );
};

renderApp(App);

// 👇 webpack-style HMR, no import.meta
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (module && (module as any).hot) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (module as any).hot.accept("./App", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const NextApp = require("./App").default;
    renderApp(NextApp);
  });
}
