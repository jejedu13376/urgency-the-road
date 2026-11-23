import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useI18n } from '../../src/context/I18nContext';
import { colors } from '../../src/theme/colors';

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      numberOfLines={1}
      style={{
        fontSize: 11,
        fontWeight: focused ? '800' : '600',
        color: focused ? colors.signal : colors.muted,
      }}
    >
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  const { t } = useI18n();

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
          title: t('tabs.monVehicule'),
          tabBarLabel: ({ focused }) => (
            <TabLabel label={t('tabs.monVehiculeShort')} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="diagnostic"
        options={{
          title: t('tabs.diagnostic'),
          tabBarLabel: ({ focused }) => (
            <TabLabel label={t('tabs.diagnosticShort')} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="carte"
        options={{
          title: t('tabs.carte'),
          tabBarLabel: ({ focused }) => (
            <TabLabel label={t('tabs.carteShort')} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="fil"
        options={{
          title: t('tabs.fil'),
          tabBarLabel: ({ focused }) => <TabLabel label={t('tabs.filShort')} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: t('tabs.menu'),
          tabBarLabel: ({ focused }) => <TabLabel label={t('tabs.menuShort')} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
