import { ProfileActions } from "fgrapher";

export const VisitorWithFollow = () => (
  <ProfileActions
    targetUserId="usr_minhanh"
    profileId="pf_minhanh"
    initialFollowerCount={1284}
    shareUrl="https://fgrapher.vn/profile/minhanh"
    socialFeedEnabled
    isOwnProfile={false}
  />
);

export const Visitor = () => (
  <ProfileActions
    targetUserId="usr_thuha"
    profileId="pf_thuha"
    initialFollowerCount={0}
    shareUrl="https://fgrapher.vn/profile/thuha-makeup"
    socialFeedEnabled={false}
    isOwnProfile={false}
  />
);

export const OwnProfile = () => (
  <ProfileActions
    targetUserId="usr_minhanh"
    profileId="pf_minhanh"
    initialFollowerCount={1284}
    shareUrl="https://fgrapher.vn/profile/minhanh"
    socialFeedEnabled
    isOwnProfile
  />
);
