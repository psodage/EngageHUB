export function successResponse(res, data, message = "OK", status = 200) {
  return res.status(status).json({
    success: true,
    message,
    data,
    error: null,
  });
}

export function errorResponse(res, message = "Request failed", status = 500, details = null) {
  return res.status(status).json({
    success: false,
    message,
    data: null,
    error: details || message,
  });
}
