import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { fr } from '../../src/i18n/fr';
import { colors } from '../../src/theme/colors';

/** Short labels to avoid truncation on 5-tab bar (full titles stay in `title`). */
const SHORT: Record<string, string> = {
  [fr.tabMonVehicule]: 'Véhicule',
  [fr.tabDiagnostic]: 'Diag',
  [fr.tabCarte]: 'Carte',
  [fr.tabFil]: 'Fil',
  [fr.tabMenu]: 'Menu',
};

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  const short = SHORT[label] ?? label;
  return (
    <Text
      numberOfLines={1}
      style={{
        fontSize: 11,
        fontWeight: focused ? '800' : '600',
        color: focused ? colors.signal : colors.muted,
      }}
    >
      {short}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.signal,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.line,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="mon-vehicule"
        options={{
          title: fr.tabMonVehicule,
          tabBarLabel: ({ focused }) => <TabLabel label={fr.tabMonVehicule} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="diagnostic"
        options={{
          title: fr.tabDiagnostic,
          tabBarLabel: ({ focused }) => <TabLabel label={fr.tabDiagnostic} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="carte"
        options={{
          title: fr.tabCarte,
          tabBarLabel: ({ focused }) => <TabLabel label={fr.tabCarte} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="fil"
        options={{
          title: fr.tabFil,
          tabBarLabel: ({ focused }) => <TabLabel label={fr.tabFil} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: fr.tabMenu,
          tabBarLabel: ({ focused }) => <TabLabel label={fr.tabMenu} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
