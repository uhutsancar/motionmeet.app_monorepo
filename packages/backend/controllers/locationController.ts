import type { RequestHandler } from "express";
import { LOCATION_DATASET_ATTRIBUTION } from "@motionmeet/shared";
import * as locationService from "../services/locationService.js";
import { formatAreaLabel, formatLocationLabel } from "../utils/locationText.js";

/**
 * Reference-data endpoints for the profile-location picker.
 *
 * Reads only. The write path lives on the user router so it sits behind the
 * same account rate limits as the rest of the profile.
 */

/** `?locale=` wins over the header so a member can preview the other language. */
const localeFor = (request: Parameters<RequestHandler>[0]) =>
  locationService.parseLocale(request.query?.locale ?? request.get("accept-language"));

export const searchLocations: RequestHandler = async (req, res, next) => {
  try {
    const limit = Number.parseInt(String(req.query?.limit ?? ""), 10);
    const suggestions = await locationService.searchLocations(req.query?.q, {
      countryCode: locationService.parseCountryCode(req.query?.country),
      locale: localeFor(req),
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    // A query below the minimum length is not an error - the field is simply
    // still being typed - so it answers with an empty list, not a 400.
    return res.json({ success: true, results: suggestions });
  } catch (error) {
    return next(error);
  }
};

export const listCountries: RequestHandler = async (req, res, next) => {
  try {
    return res.json({ success: true, results: await locationService.listCountries(localeFor(req)) });
  } catch (error) {
    return next(error);
  }
};

export const getLocation: RequestHandler = async (req, res, next) => {
  try {
    const kind = locationService.parseLocationKind(req.params.kind);
    const id = locationService.parseLocationId(req.params.id);
    if (!kind || id === null) return res.status(400).json({ success: false, message: "Invalid location reference" });

    const suggestion = await locationService.findSuggestion(kind, id, localeFor(req));
    if (!suggestion) return res.status(404).json({ success: false, message: "Location not found" });
    return res.json({ success: true, result: suggestion });
  } catch (error) {
    return next(error);
  }
};

/**
 * Turns a device fix into a *suggestion*. Nothing is stored and the profile is
 * not touched: the member still has to confirm before the location is saved.
 */
export const resolveCoordinates: RequestHandler = async (req, res, next) => {
  try {
    const latitude = Number(req.body?.latitude);
    const longitude = Number(req.body?.longitude);
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
      return res.status(400).json({ success: false, message: "Invalid coordinates" });
    }

    const locale = localeFor(req);
    const city = await locationService.findNearestCity(latitude, longitude);
    if (!city) return res.json({ success: true, suggestion: null, approximateArea: null });

    const countryName = locale === "tr" && city.countryNameTr ? city.countryNameTr : city.countryName;
    const region = city.regionName && city.regionName !== city.name ? city.regionName : null;
    return res.json({
      success: true,
      suggestion: {
        id: city.id,
        kind: "city" as const,
        name: city.name,
        displayName: formatLocationLabel({ city: city.name, region, country: countryName }),
        regionName: region,
        countryName,
        countryCode: city.countryCode,
        countryEmoji: city.countryEmoji,
      },
      approximateArea: formatAreaLabel({ city: city.name, region }),
    });
  } catch (error) {
    return next(error);
  }
};

export const listRecentLocations: RequestHandler = async (req, res, next) => {
  try {
    return res.json({ success: true, results: await locationService.listRecentSelections(req.userId, localeFor(req)) });
  } catch (error) {
    return next(error);
  }
};

/** Serves the ODbL notice so the app can show it without hardcoding a copy. */
export const getAttribution: RequestHandler = (_req, res) => {
  res.json({ success: true, attribution: LOCATION_DATASET_ATTRIBUTION });
};
