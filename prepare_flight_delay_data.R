options(scipen = 999)

args <- commandArgs(trailingOnly = TRUE)

if (length(args) >= 2) {
  output_dir <- args[2]
} else {
  output_dir <- file.path(dirname(input_file), "processed")
}

dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)


raw <- read.csv(
  input_file,
  stringsAsFactors = FALSE,
  na.strings = c("", "NA"),
  check.names = FALSE
)

expected_columns <- c(
  "year", "month", "carrier", "carrier_name", "airport", "airport_name",
  "arr_flights", "arr_del15", "carrier_ct", "weather_ct", "nas_ct",
  "security_ct", "late_aircraft_ct", "arr_cancelled", "arr_diverted",
  "arr_delay", "carrier_delay", "weather_delay", "nas_delay",
  "security_delay", "late_aircraft_delay"
)


metric_columns <- c(
  "arr_flights", "arr_del15", "carrier_ct", "weather_ct", "nas_ct",
  "security_ct", "late_aircraft_ct", "arr_cancelled", "arr_diverted",
  "arr_delay", "carrier_delay", "weather_delay", "nas_delay",
  "security_delay", "late_aircraft_delay"
)

cause_count_columns <- c(
  "carrier_ct", "weather_ct", "nas_ct", "security_ct", "late_aircraft_ct"
)

cause_delay_columns <- c(
  "carrier_delay", "weather_delay", "nas_delay",
  "security_delay", "late_aircraft_delay"
)

raw$year <- as.integer(raw$year)
raw$month <- as.integer(raw$month)
raw[metric_columns] <- lapply(raw[metric_columns], as.numeric)



expected_periods <- expand.grid(year = 2019:2025, month = 1:12)
observed_periods <- unique(raw[c("year", "month")])

expected_period_keys <- paste(expected_periods$year, expected_periods$month)
observed_period_keys <- paste(observed_periods$year, observed_periods$month)
missing_period_keys <- setdiff(expected_period_keys, observed_period_keys)



all_metrics_missing <- rowSums(!is.na(raw[metric_columns])) == 0
removed_all_missing <- sum(all_metrics_missing)
clean <- raw[!all_metrics_missing, ]


other_metric_columns <- setdiff(metric_columns, "arr_del15")
other_metrics_complete <- rowSums(is.na(clean[other_metric_columns])) == 0
zero_cause_counts <- rowSums(clean[cause_count_columns], na.rm = FALSE) == 0
zero_delay_minutes <- (
  rowSums(clean[cause_delay_columns], na.rm = FALSE) == 0 &
    clean$arr_delay == 0
)

impute_arr_del15 <- (
  is.na(clean$arr_del15) &
    other_metrics_complete &
    zero_cause_counts &
    zero_delay_minutes
)

impute_arr_del15[is.na(impute_arr_del15)] <- FALSE

imputed_arr_del15 <- sum(impute_arr_del15)
clean$arr_del15[impute_arr_del15] <- 0

remaining_missing <- colSums(is.na(clean[metric_columns]))
remaining_missing <- remaining_missing[remaining_missing > 0]

if (length(remaining_missing) > 0) {
  stop(
    "err",
    paste(names(remaining_missing), remaining_missing, sep = "=", collapse = ", ")
  )
}


cause_sum_by_row <- rowSums(clean[cause_delay_columns])
delay_difference <- clean$arr_delay - cause_sum_by_row
delay_mismatch_count <- sum(abs(delay_difference) > 0.000001)



clean_output <- file.path(
  output_dir,
  "airline_delay_cause_clean_2019_2025.csv"
)

write.csv(clean, clean_output, row.names = FALSE, na = "")



scene1_source <- clean[clean$year == 2025, ]

if (nrow(scene1_source) == 0) {
  stop("no_2025_record")
}

cause_dictionary <- data.frame(
  cause_key = c(
    "carrier", "weather", "nas", "security", "late_aircraft"
  ),
  cause = c(
    "Air Carrier Delay",
    "Weather Delay",
    "National Aviation System Delay",
    "Security Delay",
    "Late Aircraft Delay"
  ),
  source_column = cause_delay_columns,
  stringsAsFactors = FALSE
)

delay_minutes <- vapply(
  cause_dictionary$source_column,
  function(column_name) sum(scene1_source[[column_name]]),
  numeric(1)
)

scene1 <- data.frame(
  cause_key = cause_dictionary$cause_key,
  cause = cause_dictionary$cause,
  delay_minutes = unname(delay_minutes),
  stringsAsFactors = FALSE
)

scene1$share <- scene1$delay_minutes / sum(scene1$delay_minutes)
scene1 <- scene1[order(scene1$delay_minutes, decreasing = TRUE), ]
row.names(scene1) <- NULL

if (abs(sum(scene1$share) - 1) > 0.0000001) {
  stop("err")
}

scene1_output <- file.path(output_dir, "scene1_causes_2025.csv")
write.csv(scene1, scene1_output, row.names = FALSE)


