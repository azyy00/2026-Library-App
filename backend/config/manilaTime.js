const MANILA_TIME_ZONE = 'Asia/Manila';

const getFormatterParts = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  return formatter.formatToParts(date).reduce((accumulator, part) => {
    if (part.type !== 'literal') {
      accumulator[part.type] = part.value;
    }

    return accumulator;
  }, {});
};

const getSqlDateInManila = (date = new Date()) => {
  const parts = getFormatterParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const getSqlDateTimeInManila = (date = new Date()) => {
  const parts = getFormatterParts(date);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
};

const toSqlDateFromUtcCalendar = (date) => {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getManilaCalendarDate = (date = new Date()) => {
  const parts = getFormatterParts(date);

  return new Date(Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day)
  ));
};

const getStartOfWeekDateInManila = (date = new Date()) => {
  const calendarDate = getManilaCalendarDate(date);
  const weekdayIndex = (calendarDate.getUTCDay() + 6) % 7;

  calendarDate.setUTCDate(calendarDate.getUTCDate() - weekdayIndex);
  return toSqlDateFromUtcCalendar(calendarDate);
};

const getEndOfWeekDateInManila = (date = new Date()) => {
  const calendarDate = new Date(getManilaCalendarDate(date));
  const weekdayIndex = (calendarDate.getUTCDay() + 6) % 7;

  calendarDate.setUTCDate(calendarDate.getUTCDate() + (6 - weekdayIndex));
  return toSqlDateFromUtcCalendar(calendarDate);
};

const getStartOfMonthDateInManila = (date = new Date()) => {
  const calendarDate = getManilaCalendarDate(date);
  calendarDate.setUTCDate(1);
  return toSqlDateFromUtcCalendar(calendarDate);
};

const getEndOfMonthDateInManila = (date = new Date()) => {
  const calendarDate = getManilaCalendarDate(date);
  calendarDate.setUTCMonth(calendarDate.getUTCMonth() + 1, 0);
  return toSqlDateFromUtcCalendar(calendarDate);
};

const getManilaClock = (date = new Date()) => {
  const parts = getFormatterParts(date);

  return {
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
};

module.exports = {
  getEndOfMonthDateInManila,
  getEndOfWeekDateInManila,
  MANILA_TIME_ZONE,
  getManilaClock,
  getManilaCalendarDate,
  getSqlDateInManila,
  getSqlDateTimeInManila,
  getStartOfMonthDateInManila,
  getStartOfWeekDateInManila
};
