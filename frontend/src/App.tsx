// frontend/src/App.tsx
import React from "react";
import { Switch, Route } from "react-router-dom";

import Home from "./pages/Home";
import Mint from "./pages/Mint";
import Tokens from "./pages/Tokens";
import ExchangePage from "./components/ExchangePageOrg";
import { btms } from "./btmsClient";

const App: React.FC = () => {
  return (
    <Switch>
      <Route exact path="/" render={(props) => <Home {...props} />} />

      <Route exact path="/mint" render={(props) => <Mint {...props} />} />

      {/* list tokens / generic view */}
      <Route
        exact
        path="/tokens"
        render={(props) => <Tokens {...(props as any)} />}
      />

      {/* token detail */}
      <Route
        path="/tokens/:assetId"
        render={(props) => <Tokens {...(props as any)} />}
      />

      <Route
        path="/exchange"
        render={(props) => <ExchangePage {...props} btms={btms} />}
      />

      {/* fallback */}
      <Route render={(props) => <Home {...props} />} />
    </Switch>
  );
};

export default App;
