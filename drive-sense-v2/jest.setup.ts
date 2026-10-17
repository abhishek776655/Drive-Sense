jest.mock('@expo/vector-icons', () => {
  return {
    Ionicons: 'Ionicons',
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// No native SQLite in Jest: the app runs on the API unless a test installs an in-memory database
// with `setDbForTests` (src/db).
jest.mock('./src/db/sql.native', () => ({openNativeDb: () => null}));
