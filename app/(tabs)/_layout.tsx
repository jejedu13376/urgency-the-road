import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fr } from '../../src/i18n/fr';
import { colors } from '../../src/theme/colors';

/** Short labels so 5 tabs stay readable; full titles remain in `title` / a11y. */
const SHORT: Record<string, string> = {
  [fr.tabMonVehicule]: 'Véhicule',
  [fr.tabDiagnostic]: 'Diag',
  [fr.tabCarte]: 'Carte',
  [fr.tabFil]: 'Fil',
  [fr.tabMenu]: 'Menu',
};

const ICON_SIZE = 22;
const LABEL_FONT = 11;
const LABEL_LINE = 14;
const PAD_TOP = 4;
/** Icon + gap + label — must fit above safe-area padding so text is not clipped. */
const TAB_CONTENT = ICON_SIZE + 4 + LABEL_LINE;

function tint(color: ColorValue | undefined): string {
  return typeof color === 'string' && color.length > 0 ? color : colors.muted;
}

function TabLabel({ label, color }: { label: string; color: ColorValue }) {
  const short = SHORT[label] ?? label;
  return (
    <Text
      numberOfLines={1}
      allowFontScaling={false}
      style={{
        fontSize: LABEL_FONT,
        lineHeight: LABEL_LINE,
        fontWeight: '700',
        color: tint(color),
        includeFontPadding: false,
        textAlign: 'center',
        marginTop: 2,
      }}
    >
      {short}
    </Text>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  const tabBarHeight = PAD_TOP + TAB_CONTENT + bottomPad;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.signal,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: {
          fontSize: LABEL_FONT,
          lineHeight: LABEL_LINE,
          fontWeight: '700',
          marginTop: 0,
          marginBottom: 0,
        },
        tabBarIconStyle: {
          marginTop: 0,
        },
        tabBarItemStyle: {
          paddingTop: 0,
          paddingBottom: 0,
        },
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: bottomPad,
          paddingTop: PAD_TOP,
        },
      }}
    >
      <Tabs.Screen
        name="mon-vehicule"
        options={{
          title: fr.tabMonVehicule,
          tabBarAccessibilityLabel: fr.tabMonVehicule,
          tabBarLabel: ({ color }) => <TabLabel label={fr.tabMonVehicule} color={color} />,
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="car-estate" size={ICON_SIZE} color={tint(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="diagnostic"
        options={{
          title: fr.tabDiagnostic,
          tabBarAccessibilityLabel: fr.tabDiagnostic,
          tabBarLabel: ({ color }) => <TabLabel label={fr.tabDiagnostic} color={color} />,
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="car-wrench" size={ICON_SIZE} color={tint(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="carte"
        options={{
          title: fr.tabCarte,
          tabBarAccessibilityLabel: fr.tabCarte,
          tabBarLabel: ({ color }) => <TabLabel label={fr.tabCarte} color={color} />,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'map' : 'map-outline'}
              size={ICON_SIZE}
              color={tint(color)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="fil"
        options={{
          title: fr.tabFil,
          tabBarAccessibilityLabel: fr.tabFil,
          tabBarLabel: ({ color }) => <TabLabel label={fr.tabFil} color={color} />,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
              size={ICON_SIZE}
              color={tint(color)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: fr.tabMenu,
          tabBarAccessibilityLabel: fr.tabMenu,
          tabBarLabel: ({ color }) => <TabLabel label={fr.tabMenu} color={color} />,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'grid' : 'grid-outline'}
              size={ICON_SIZE}
              color={tint(color)}
            />
          ),
        }}
      />
    </Tabs>
  );
}
