import { SearchInput } from "fgrapher";

export const WithMarketplace = () => (
  <div className="w-96">
    <SearchInput marketplaceEnabled />
  </div>
);

export const WithoutMarketplace = () => (
  <div className="w-96">
    <SearchInput marketplaceEnabled={false} />
  </div>
);
