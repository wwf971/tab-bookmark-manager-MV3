/**
 * Get local timezone offset in hours (positive for east of UTC, negative for west)
 * @returns {number} Timezone offset in hours
 */
export function get_local_timezone_int() {
    return new Date().getTimezoneOffset() / -60
} 