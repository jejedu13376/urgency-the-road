import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../src/context/I18nContext';
import { colors } from '../../src/theme/colors';

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
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  const { t } = useI18n();
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
          title: t('tabs.monVehicule'),
          tabBarAccessibilityLabel: t('tabs.monVehicule'),
          tabBarLabel: ({ color }) => <TabLabel label={t('tabs.monVehiculeShort')} color={color} />,
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="car-estate" size={ICON_SIZE} color={tint(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="diagnostic"
        options={{
          title: t('tabs.diagnostic'),
          tabBarAccessibilityLabel: t('tabs.diagnostic'),
          tabBarLabel: ({ color }) => <TabLabel label={t('tabs.diagnosticShort')} color={color} />,
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="car-wrench" size={ICON_SIZE} color={tint(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="carte"
        options={{
          title: t('tabs.carte'),
          tabBarAccessibilityLabel: t('tabs.carte'),
          tabBarLabel: ({ color }) => <TabLabel label={t('tabs.carteShort')} color={color} />,
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
          title: t('tabs.fil'),
          tabBarAccessibilityLabel: t('tabs.fil'),
          tabBarLabel: ({ color }) => <TabLabel label={t('tabs.filShort')} color={color} />,
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
          title: t('tabs.menu'),
          tabBarAccessibilityLabel: t('tabs.menu'),
          tabBarLabel: ({ color }) => <TabLabel label={t('tabs.menuShort')} color={color} />,
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
