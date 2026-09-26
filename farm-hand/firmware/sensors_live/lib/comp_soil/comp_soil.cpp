#include "comp_soil.h"

#define SOIL_SAMPLES 16

static const int pins[SOIL_COUNT]      = {SOIL_A_PIN, SOIL_B_PIN, 32, 33};

/* Calibration follows the pin: D35 water 1875 measured 2026-09-26, air ~3450 from open-air readings (fine-tune once it's
   fully dry). D34 measured 2026-09-23. D32/D33 unused. Re-check both if the probes were swapped when the board was soldered. */
static const int raw_air[SOIL_COUNT]   = {3450, 3400, 3400, 3400};
static const int raw_water[SOIL_COUNT] = {1875, 1507, 1507, 1507};

StatusCode_e    SOIL_init(void)
{
    analogReadResolution(12);

    return STATUS_OK;
}

StatusCode_e    SOIL_update(SoilReading_t *out)
{
    for (int i = 0; i < SOIL_COUNT; i++)
    {
        long sum = 0;
        for (int k = 0; k < SOIL_SAMPLES; k++)
        {
            sum += analogRead(pins[i]);
        }
        out->raw[i] = sum / SOIL_SAMPLES;

        float pct = 100.0f * (raw_air[i] - out->raw[i]) / (raw_air[i] - raw_water[i]);
        out->pct[i] = constrain(pct, 0.0f, 100.0f);
    }

    return STATUS_OK;
}