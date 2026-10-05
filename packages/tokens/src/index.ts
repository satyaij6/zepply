// Design tokens shared by web and mobile so both apps look like one product.
// Values below come from the current landing page; the full brand palette is
// finalised with the new home page design.

export const colors = {
  ink: "#0d0d0d",
  surface: "#ffffff",
  navSurface: "#333338",
  navText: "rgba(255,255,255,0.80)",
  navTextActive: "#ffffff",
} as const;

export const fonts = {
  display: "Poppins",
  body: "Inter",
  logo: "Glitz",
} as const;

export const radii = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

export type ColorToken = keyof typeof colors;
