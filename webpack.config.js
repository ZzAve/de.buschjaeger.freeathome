const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const webpack = require("webpack");
const fs = require("fs");
const path = require("path");

const distPath = path.resolve(__dirname, "./dist");

const package = require("./package.json");
const appPackage = require("./app.json");

if (package.version.indexOf("-") > 0) {
  appPackage.version = package.version.substring(
    0,
    package.version.indexOf("-")
  );
} else {
  appPackage.version = package.version;
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
      __VERSION: JSON.stringify(package.version),
      __BUILD: JSON.stringify(process.env.TRAVIS_BUILD_NUMBER)
    }),

    // source-map is wrong for typescript code but better than nothing
    PRODUCTION
      ? new webpack.SourceMapDevToolPlugin({
          filename: "[file].map",
          publicPath: `https://raw.githubusercontent.com/zzave/de.buschjaeger.freeathome/release/v${package.version}/`
        })
      : null,

    new CleanWebpackPlugin(),
    new CopyWebpackPlugin([
      {
        from: "./tmp/app.json",
        to: distPath
      },
      {
        from: "./*.md",
        to: distPath
      },
      {
        from: "./LICENSE",
        to: distPath
      },
      {
        from: "./.homeyignore",
        to: distPath
      },
      {
        from: "./.homeyplugins.json",
        to: distPath
      },
      {
        from: "./APPSTORE.md",
        to: distPath
      },
      {
        from: "assets/**/*.png",
        to: distPath
      },
      {
        from: "assets/**/*.svg",
        to: distPath
      },
      {
        from: "**/assets/**/*",
        context: "drivers",
        to: distPath + "/drivers"
      },
      {
        from: "**/*.json",
        context: "drivers",
        to: distPath + "/drivers"
      },
      {
        from: "settings/**/*",
        to: distPath
      },
      {
        from: "locales/**/*",
        to: distPath
      }
    ])
  ].filter(Boolean);

  return {
    target: "node",
    entry: {
      app: "./app.js",
      api: "./api.js",
      "drivers/switch/driver": "./drivers/switch/driver.js",
      "drivers/switch/device": "./drivers/switch/device.js"
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: /node_modules/
        }
      ]
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js"]
    },
    plugins: plugins,
    output: {
      filename: "[name].js",
      path: distPath,
      libraryTarget: "commonjs2"
    },

    devtool: PRODUCTION ? false : "inline-source-map",

    externals: {
      homey: "homey",
      bufferutil: "bufferutil",
      "utf-8-validate": "utf-8-validate"
    }
  };
};
module.exports = appConfig;
