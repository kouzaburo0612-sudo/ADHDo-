import { Redirect } from 'expo-router';
import { useAppStore } from '../store/useAppStore';

export default function Index() {
  const done = useAppStore((s) => s.settings.onboarding_done === '1');
  return <Redirect href={done ? '/(tabs)/today' : '/(onboarding)/welcome'} />;
}
