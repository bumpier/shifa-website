const BASE = "/certifications";

export interface Cert {
  compound: string;
  batch: string;
  url: string;
}

export const CERTIFICATIONS: Record<string, Cert[]> = {
  "retatrutide-pen": [
    { compound: "Retatrutide", batch: "NC-20015", url: `${BASE}/NovaCert_COA_Retatrutide_NC-20015.pdf` },
  ],
  "cutpr-prime-cut-protocol": [
    { compound: "Tesamorelin", batch: "NC-20013", url: `${BASE}/NovaCert_COA_Tesamorelin_NC-20013.pdf` },
  ],
  "bptb-repair-pen": [
    { compound: "TB-500", batch: "NC-20012", url: `${BASE}/NovaCert_COA_TB500_NC-20012.pdf` },
  ],
  "wol10-wolverine-protocol": [
    { compound: "TB-500", batch: "NC-20012", url: `${BASE}/NovaCert_COA_TB500_NC-20012.pdf` },
  ],
  "gku50-ghk-cu-regeneration-pen": [
    { compound: "GHK-Cu", batch: "NC-20004", url: `${BASE}/NovaCert_COA_GHKCu_NC-20004.pdf` },
  ],
  "glow10-glow-protocol": [
    { compound: "GHK-Cu", batch: "NC-20004", url: `${BASE}/NovaCert_COA_GHKCu_NC-20004.pdf` },
  ],
  "cjip10-growth-signal-pen": [
    { compound: "Ipamorelin", batch: "NC-20005", url: `${BASE}/NovaCert_COA_Ipamorelin_NC-20005.pdf` },
  ],
  "nd1000-nad-cellular-energy-pen": [
    { compound: "NAD+", batch: "NC-20014", url: `${BASE}/NovaCert_COA_NADplus_NC-20014.pdf` },
  ],
  "regen-regenesis-protocol": [
    { compound: "Epithalon", batch: "NC-20003", url: `${BASE}/NovaCert_COA_Epithalon_NC-20003.pdf` },
  ],
  "mt40-motsc-mitochondrial-pen": [
    { compound: "MOTS-c", batch: "NC-20007", url: `${BASE}/NovaCert_COA_MOTSc_NC-20007.pdf` },
  ],
  "deepsleep-deep-sleep-protocol": [
    { compound: "DSIP", batch: "NC-20002", url: `${BASE}/NovaCert_COA_DSIP_NC-20002.pdf` },
  ],
  "libido-libido-protocol": [
    { compound: "Kisspeptin-10", batch: "NC-20006", url: `${BASE}/NovaCert_COA_Kisspeptin10_NC-20006.pdf` },
    { compound: "PT-141", batch: "NC-20008", url: `${BASE}/NovaCert_COA_PT141_NC-20008.pdf` },
  ],
};
