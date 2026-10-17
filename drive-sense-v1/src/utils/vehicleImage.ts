/** Stand-in car photo for vehicles with no `image_url` of their own. */
export const FALLBACK_VEHICLE_IMAGE =
  'https://res.cloudinary.com/socialcloud/image/upload/v1786658014/Slavia_tu9faw.png';

/** Image source for a vehicle, falling back to the shared photo when the catalog has none. */
export const vehicleImageSource = (imageUrl?: string | null) => ({
  uri: imageUrl && imageUrl.trim().length > 0 ? imageUrl : FALLBACK_VEHICLE_IMAGE,
});
