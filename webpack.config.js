const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const webpack = require("webpack");
const fs = require("fs");
const path = require("path");

const distPath = path.resolve(__dirname, "./dist");

const packageJson = require("./package.json");
const appPackage = require("./app.json");

if (packageJson.version.indexOf("-") > 0) {
  appPackage.version = packageJson.version.substring(
    0,
    packageJson.version.indexOf("-")
  );
} else {
  appPackage.version = packageJson.version;
}

const tempDir = __dirname + "/tmp";
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}
fs.writeFileSync(tempDir + "/app.json", JSON.stringify(appPackage, null, 4));

const appConfig = (env, argv) => {
  const PRODUCTION = argv.mode === "production";
  const plugins = [
    new webpack.DefinePlugin({
      __PRODUCTION__: JSON.stringify(PRODUCTION),
      __VERSION: JSON.stringify(packageJson.version),
      __BUILD: JSON.stringify(process.env.TRAVIS_BUILD_NUMBER),
    }),

    // // source-map is wrong for typescript code but better than nothing
    // PRODUCTION
    //   ? new webpack.SourceMapDevToolPlugin({
    //       filename: "[file].map",
    //       publicPath: `https://raw.githubusercontent.com/zzave/de.buschjaeger.freeathome/release/v${package.version}/`
    //     })
    //   : null,

    new CleanWebpackPlugin(),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "./tmp/app.json",
          to: distPath,
        },
        {
          from: "./*.md",
          to: distPath,
        },
        {
          from: "./LICENSE",
          to: distPath,
        },
        {
          from: "./.homeyignore",
          to: distPath,
        },
        {
          from: "./.homeyplugins.json",
          to: distPath,
        },
        {
          from: "./APPSTORE.md",
          to: distPath,
        },
        {
          from: "assets/**/*",
          to: distPath,
        },
        // {
        //   from: "**/assets/**/*",
        //   context: "drivers",
        //   to: distPath + "/drivers"
        // },
        {
          from: "**/*.json",
          context: "drivers",
          to: distPath + "/drivers",
        },
        {
          from: "settings/**/*",
          to: distPath,
        },
        {
          from: ".homeycompose/**/*",
          to: distPath,
        },
        {
          from: "locales/**/*",
          to: distPath,
        },
      ],
    }),
  ].filter(Boolean);

  return {
    target: "node",
    entry: {
      app: "./app.ts",
      api: "./api.ts",
      "drivers/switch/driver": "./drivers/switch/driver.js",
      "drivers/switch/device": "./drivers/switch/device.js",
      "drivers/dimmer/driver": "./drivers/dimmer/driver.js",
      "drivers/dimmer/device": "./drivers/dimmer/device.js",
      "drivers/blind/driver": "./drivers/blind/driver.js",
      "drivers/blind/device": "./drivers/blind/device.js",
      "drivers/heating/driver": "./drivers/heating/driver.js",
      "drivers/heating/device": "./drivers/heating/device.js",
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
    },
    plugins: plugins,
    output: {
      filename: "[name].js",
      path: distPath,
      libraryTarget: "commonjs2",
    },

    devtool: PRODUCTION ? false : "eval-source-map",
    // devtool: PRODUCTION ? false : "cheap-module-eval-source-map",

    externals: {
      homey: "homey",
      bufferutil: "bufferutil",
      "utf-8-validate": "utf-8-validate",
    },
  };
};
module.exports = appConfig;
