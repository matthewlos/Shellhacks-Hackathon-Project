#ifndef SYS_DATA_H
#define SYS_DATA_H

#include "sys_target.h"

#define SOIL_COUNT      2
#define TEMP_MAX        2
#define LOOP_PERIOD_MS  1000

typedef struct
{
    int     raw[SOIL_COUNT];        /* ADC average, higher = drier */
    float   pct[SOIL_COUNT];        /* 0 = air, 100 = water */
} SoilReading_t;

typedef struct
{
    int     count;                  /* probes found on the bus */
    char    id[TEMP_MAX][17];       /* 64-bit ROM address as hex */
    float   celsius[TEMP_MAX];
    bool    ok[TEMP_MAX];           /* false = probe dropped off (library returns -127) */
} TempReading_t;

#endif