// Expo SDK 56 기본 metro 설정에 .tflite 자산을 추가한다.
// react-native-fast-tflite 는 require('./model.tflite') 로 모델 파일을 읽으므로
// Metro 의 assetExts 에 'tflite' 가 포함되어 있어야 번들 시 해결된다.
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('tflite');

module.exports = config;
