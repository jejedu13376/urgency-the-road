import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme/colors';
import { PressScale } from '../theme/motion';

type Props = {
  title: string;
  /** Price or other essential line under the title (e.g. "42 CAD" or "70 000 km"). */
  priceLine: string;
  /** Ionicons glyph for the photo placeholder. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Accent behind the photo panel. */
  photoTone?: string;
  onPress?: () => void;
  selected?: boolean;
  /** Full-bleed fiche (vehicle sheet) vs 2-column catalog tile. */
  fullWidth?: boolean;
  accessibilityLabel?: string;
  children?: ReactNode;
};

/**
 * Canadian Tire / Amazon-style product tile:
 * photo on top, name, then price — nothing else on the card face.
 * Large high-contrast type for dyslexia-friendly reading.
 */
export function CatalogProductCard({
  title,
  priceLine,
  icon = 'cube-outline',
  photoTone = colors.mist,
  onPress,
  selected,
  fullWidth,
  accessibilityLabel,
  children,
}: Props) {
  const body = (
    <>
      <View
        style={[styles.photo, fullWidth && styles.photoWide, { backgroundColor: photoTone }]}
        accessibilityElementsHidden
      >
        <Ionicons name={icon} size={fullWidth ? 64 : 48} color={colors.ink} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.price}>{priceLine}</Text>
        {children}
      </View>
    </>
  );

  const cardStyle = [styles.card, fullWidth && styles.cardFull, selected && styles.cardOn];
  const a11y = accessibilityLabel ?? `${title}, ${priceLine}`;

  if (onPress) {
    return (
      <PressScale
        style={cardStyle}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        pressedScale={0.96}
      >
        {body}
      </PressScale>
    );
  }

  return (
    <View style={cardStyle} accessibilityLabel={a11y}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    maxWidth: '48%',
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.ink,
    overflow: 'hidden',
  },
  cardFull: {
    flexBasis: '100%',
    maxWidth: '100%',
    width: '100%',
  },
  cardOn: {
    borderColor: colors.signal,
    backgroundColor: colors.signalSoft,
  },
  photo: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
  },
  photoWide: {
    height: 168,
  },
  copy: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
    minHeight: 88,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
    lineHeight: 24,
    letterSpacing: 0.2,
  },
  price: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.signal,
    letterSpacing: 0.2,
  },
});
