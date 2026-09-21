const IS_PROD = process.env.NODE_ENV === "production";

export const setAuthCookies = (
  res,
  accessToken,
  refreshToken
) => {
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? "none" : "lax",
    maxAge: 15 * 60 * 1000,
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};
