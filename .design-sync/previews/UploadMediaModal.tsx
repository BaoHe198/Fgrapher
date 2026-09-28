import { UploadMediaModal } from "fgrapher";

const noop = () => {};

export const IntoAlbum = () => (
  <UploadMediaModal
    open
    onOpenChange={noop}
    profileId="pf_minhanh"
    albumId="al_cuoi_dalat"
    role="PHOTOGRAPHER"
    onUploaded={noop}
  />
);

export const ImageOnly = () => (
  <UploadMediaModal
    open
    onOpenChange={noop}
    profileId="pf_ao_dai_xua"
    albumId="al_trang_phuc"
    role="COSTUME_SHOP"
    imageOnly
    onUploaded={noop}
  />
);

export const PickAlbumFirst = () => (
  <UploadMediaModal
    open
    onOpenChange={noop}
    profileId="pf_thuha"
    role="MAKEUP_ARTIST"
    onUploaded={noop}
  />
);
