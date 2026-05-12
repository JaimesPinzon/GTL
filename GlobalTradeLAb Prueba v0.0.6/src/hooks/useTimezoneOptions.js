import { useEffect, useMemo, useState } from "react";

import { getTimezonesFromBackend } from "@/lib/backend-preferences";
import { getDefaultTimezone, normalizeTimezoneValue } from "@/lib/timezones";

export function useTimezoneOptions(currentTimezone) {
  const [timezoneOptions, setTimezoneOptions] = useState([]);

  useEffect(() => {
    let isMounted = true;

    getTimezonesFromBackend()
      .then((results) => {
        if (!isMounted) {
          return;
        }

        const nextOptions = results
          .map((entry) => entry?.value)
          .filter((value) => typeof value === "string" && value.trim().length > 0);

        setTimezoneOptions(nextOptions);
      })
      .catch((error) => {
        console.error("getTimezonesFromBackend error", error);

        if (isMounted) {
          setTimezoneOptions([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const resolvedTimezone = useMemo(
    () => normalizeTimezoneValue(currentTimezone, timezoneOptions, getDefaultTimezone()),
    [currentTimezone, timezoneOptions]
  );

  const normalizedTimezoneOptions = useMemo(() => {
    const options = timezoneOptions.length > 0 ? timezoneOptions : [resolvedTimezone];

    return Array.from(
      new Set(
        options.map((option) =>
          normalizeTimezoneValue(option, timezoneOptions, getDefaultTimezone())
        )
      )
    );
  }, [resolvedTimezone, timezoneOptions]);

  return {
    normalizedTimezoneOptions,
    resolvedTimezone,
  };
}

