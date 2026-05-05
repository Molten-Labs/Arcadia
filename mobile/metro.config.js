const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  buffer: require.resolve('buffer'),
  stream: require.resolve('stream-browserify'),
  events: require.resolve('events'),
};

// Resolve react-native-web aliases for web platform
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

module.exports = config;
