import { RoleSelectionForm } from "fgrapher";

const rolePrices = {
  PHOTOGRAPHER: 390000,
  VIDEOGRAPHER: 390000,
  MAKEUP_ARTIST: 390000,
  MODEL: 390000,
  CAMERA_SHOP: 490000,
  COSTUME_SHOP: 490000,
  STUDIO: 690000,
};

export const AllRoles = () => (
  <RoleSelectionForm rolePrices={rolePrices} marketplaceEnabled />
);

export const WithoutShops = () => (
  <RoleSelectionForm rolePrices={rolePrices} marketplaceEnabled={false} />
);
