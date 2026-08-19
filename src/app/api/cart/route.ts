import { NextResponse } from "next/server";

import { AuthError, requireAuth } from "@/lib/auth-helpers";
import { addToCartSchema } from "@/lib/validations/marketplace";
import { addToCart, CartError, getCart } from "@/services/marketplace";

export async function GET() {
  try {
    const session = await requireAuth();
    const items = await getCart(session.user.id);

    return NextResponse.json({ data: items, error: null, message: null }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to load cart" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const parsed = addToCartSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          data: null,
          error: "validation_error",
          message: parsed.error.issues[0]?.message ?? "Invalid input",
        },
        { status: 400 },
      );
    }

    const item = await addToCart({
      userId: session.user.id,
      productId: parsed.data.productId,
      quantity: parsed.data.quantity,
      type: parsed.data.type,
      rentalStart: parsed.data.rentalStart ? new Date(parsed.data.rentalStart) : undefined,
      rentalEnd: parsed.data.rentalEnd ? new Date(parsed.data.rentalEnd) : undefined,
    });

    return NextResponse.json({ data: item, error: null, message: "Added to cart" }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { data: null, error: "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    if (err instanceof CartError) {
      return NextResponse.json(
        { data: null, error: "cart_error", message: err.message },
        { status: err.status },
      );
    }

    return NextResponse.json(
      { data: null, error: "server_error", message: "Failed to add to cart" },
      { status: 500 },
    );
  }
}
