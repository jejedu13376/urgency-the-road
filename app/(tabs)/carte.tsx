import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { useFleet } from '../../src/context/FleetContext';
import { colors } from '../../src/theme/colors';

/** Hub carte — Modules 7 · 8 · 9 (+ liens urgence / partage). */
export default function CarteHub() {
  const { active } = useFleet();
  const isPl =
    active?.vehicleClass === 'poids_lourd' || active?.powertrain === 'poids_lourd_diesel';

  return (
    <Screen
      title="Carte"
      subtitle={`Modules 7 · 8 · 9${active ? ` · ${active.label}` : ''}`}
    >
      <Card title="Contexte véhicule">
        <Text style={styles.meta}>
          {active
            ? `${active.make} ${active.model} · ${active.country} · ${
                isPl ? 'Mode PL recommandé' : 'Mode voiture'
              }`
            : 'Aucun véhicule actif — activez Mon véhicule (M1/M2).'}
        </Text>
        {isPl ? (
          <View style={styles.banner}>
            <Text style={styles.bannerTxt}>
              Poids lourd détecté — priorisez GPS camion (M7) et balances allumées (M8).
            </Text>
          </View>
        ) : null}
      </Card>

      <Card title="Navigation & proximité">
        <Link href="/modules/gps" asChild>
          <Pressable style={styles.item}>
            <Text style={styles.id}>M7</Text>
            <View style={styles.body}>
              <Text style={styles.title}>Double GPS (camion / voiture)</Text>
              <Text style={styles.sub}>Hauteur · PTAC · transfert Maps / Waze / Apple Plans</Text>
            </View>
          </Pressable>
        </Link>
        <Link href="/modules/routiers" asChild>
          <Pressable style={styles.item}>
            <Text style={styles.id}>M8</Text>
            <View style={styles.body}>
              <Text style={styles.title}>Routiers — pesage & dépôts PL</Text>
              <Text style={styles.sub}>Balances ON/OFF · loi camionnage · dépôts pièces</Text>
            </View>
          </Pressable>
        </Link>
        <Link href="/modules/garages" asChild>
          <Pressable style={styles.item}>
            <Text style={styles.id}>M9</Text>
            <View style={styles.body}>
              <Text style={styles.title}>Garages, dépanneurs & magasins</Text>
              <Text style={styles.sub}>Appel 1 clic · distance · horaires mock</Text>
            </View>
          </Pressable>
        </Link>
      </Card>

      <Card title="Liens utiles sur la route">
        <Link href="/modules/urgence" asChild>
          <Pressable style={styles.linkRow}>
            <Text style={styles.linkTxt}>SOS / fiche médicale (M13) →</Text>
          </Pressable>
        </Link>
        <Link href="/modules/pro" asChild>
          <Pressable style={styles.linkRow}>
            <Text style={styles.linkTxt}>Réserver un créneau atelier (M17) →</Text>
          </Pressable>
        </Link>
        <Link href="/modules/pieces" asChild>
          <Pressable style={styles.linkRow}>
            <Text style={styles.linkTxt}>Catalogue pièces à proximité (M3) →</Text>
          </Pressable>
        </Link>
        <Link href="/modules/partage" asChild>
          <Pressable style={styles.linkRow}>
            <Text style={styles.linkTxt}>Partager sa position / l’app (M16) →</Text>
          </Pressable>
        </Link>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { color: colors.muted, fontSize: 12 },
  banner: {
    marginTop: 8,
    backgroundColor: colors.warnSoft,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.warn,
  },
  bannerTxt: { color: colors.ink, fontWeight: '700', fontSize: 12 },
  item: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    alignItems: 'flex-start',
  },
  id: {
    backgroundColor: colors.asphalt,
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  body: { flex: 1, gap: 2 },
  title: { fontWeight: '700', color: colors.ink },
  sub: { color: colors.muted, fontSize: 12 },
  linkRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  linkTxt: { color: colors.signal, fontWeight: '800', fontSize: 13 },
});
