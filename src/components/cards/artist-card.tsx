import { MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { StarRating } from "@/components/ui/star-rating";

interface ArtistCardProps {
  artist: {
    id: string;
    name: string;
    username: string;
    role: string;
    city: string;
    rating: string | number;
    reviews: number;
    price: string;
    coverImage?: string;
    tint?: string;
  };
  onClick?: () => void;
}

export function ArtistCard({ artist, onClick }: ArtistCardProps) {
  return (
    <Link href={`/profile/${artist.username}`} onClick={onClick}>
      <Card
        padding={false}
        className="cursor-pointer transition-shadow duration-150 hover:shadow-[var(--shadow-md)]"
      >
        {artist.coverImage ? (
          <div className="relative h-[180px] w-full">
            <Image
              src={artist.coverImage}
              alt={artist.name}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <MediaPlaceholder tint={artist.tint ?? "neutral-300"} height={180} />
        )}

        <div className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-heading-sm font-semibold text-text-primary">
              {artist.name}
            </span>
            <Badge variant="accent">{artist.role}</Badge>
          </div>

          <div className="flex items-center gap-1 text-body-sm text-text-secondary">
            <MapPin className="size-3.5" />
            {artist.city}
          </div>

          <StarRating rating={artist.rating} reviews={artist.reviews} />

          <span className="text-body-md font-semibold text-text-primary">
            {artist.price}
          </span>
        </div>
      </Card>
    </Link>
  );
}
