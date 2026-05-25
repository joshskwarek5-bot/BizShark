import { cache } from "react";
import { db } from "./db";

export const getRestaurantBySlug = cache(async (slug: string) => {
  return db.restaurant.findUnique({ where: { slug } });
});

export const getRestaurantWithMenu = cache(async (slug: string) => {
  return db.restaurant.findUnique({
    where: { slug },
    include: {
      categories: {
        orderBy: { displayOrder: "asc" },
        include: {
          items: {
            orderBy: { displayOrder: "asc" },
          },
        },
      },
    },
  });
});
