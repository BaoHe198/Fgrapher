import { z } from "zod";

export const MAX_POST_MEDIA = 6;

export const createPostSchema = z.object({
  caption: z.string().max(2000).optional(),
  media: z
    .array(
      z.object({
        url: z.string().min(1),
        publicId: z.string().nullish(),
        type: z.enum(["IMAGE", "VIDEO"]).default("IMAGE"),
      }),
    )
    .max(MAX_POST_MEDIA)
    .default([]),
});

export const createCommentSchema = z.object({
  content: z.string().trim().min(1, "Write something").max(1000),
});
