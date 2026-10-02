import { FeatureClosed } from "@/components/sections/feature-closed";
import { features } from "@/lib/features";

export default function NotFound() {
  return (
    <FeatureClosed feature="community" open={features.socialFeedEnabled} />
  );
}
