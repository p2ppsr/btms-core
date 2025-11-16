const path = require("path");

module.exports = {
  // ...existing config
  resolve: {
    // keep your existing resolve stuff here
    alias: {
      // force everybody to use this project's React
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      "react-native-get-random-values": path.resolve(
        __dirname,
        "src/shims/react-native-get-random-values.ts",
      ),
      // 👇 force anything that tries to import the packaged btms file
      // to use YOUR source version instead
      "btms-core/dist/frontend/src/btms": path.resolve(__dirname, "src/btms"),
      "btms-core/dist/frontend/src/btms/index.js": path.resolve(
        __dirname,
        "src/btms/index.ts",
      ),
    },
  },
};
