#include "comp_soil.h"

#define SOIL_SAMPLES 16

static const int pins[SOIL_COUNT]      = {SOIL_A_PIN, SOIL_B_PIN};

/* Probe A measured 2026-09-23 (dry air, water up to the line). Probe B: NOT calibrated yet, uses A's numbers */
static const int raw_air[SOIL_COUNT]   = {3400, 3400};
static const int raw_water[SOIL_COUNT] = {1507, 1507};

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