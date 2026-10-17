import {Redirect} from 'expo-router';

/** Older links to /register land on the new sign-up flow. */
export default function RegisterScreen() {
  return <Redirect href="/signup" />;
}
