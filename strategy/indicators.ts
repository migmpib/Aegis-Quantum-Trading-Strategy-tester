import { IndicatorName, Operator } from '../types';

type ParameterType = 'number' | 'string';

interface ParameterConfig {
    label: string;
    type: ParameterType;
    options?: string[];
}

interface IndicatorConfig {
    parameters: Record<string, ParameterConfig>;
}

export const INDICATOR_CONFIG: Record<IndicatorName, IndicatorConfig> = {
    "Quantitative Score": {
        parameters: {
            composite_score: { label: 'Composite Score', type: 'number' },
            structural_score: { label: 'Structural Score', type: 'number' },
        },
    },
    "CRF": {
        parameters: {
            regime: { label: 'Regime', type: 'string', options: ['Volatility Squeeze', 'Strong Bullish Trend', 'Developing Bullish Trend', 'Strong Bearish Trend', 'Developing Bearish Trend', 'Stable Range', 'Choppy Range'] },
        }
    },
    "VPE": {
        parameters: {
            potential: { label: 'Potential %', type: 'number' },
        }
    },
    "Volatility": {
        parameters: {
            historical_volatility_rank: { label: 'HV Rank', type: 'number' },
            bollinger_band_width_pct: { label: 'BBW %', type: 'number' },
            keltner_channels_squeeze: { label: 'Squeeze Status', type: 'string', options: ['SQUEEZE_DETECTED', 'No Squeeze'] }
        }
    },
    "BTC Correlation": {
        parameters: {
            relative_performance: { label: 'Relative Perf.', type: 'string', options: ['Outperforming BTC', 'Underperforming BTC', 'Neutral'] },
        }
    },
    "HVN Migration": {
        parameters: {
            status: { label: 'Status', type: 'string', options: ['Migrating Up (Bullish)', 'Migrating Down (Bearish)', 'Stagnant (Neutral)'] },
        }
    },
    "Chimera": {
        parameters: {
            fer: { label: 'Fractal Efficiency (FER)', type: 'number' },
            vdr: { label: 'VWAP Deviation (VDR)', type: 'number' },
            mfi_v: { label: 'Momentum Flow (MFI-V)', type: 'number' },
        }
    },
};


export const OPERATORS: { numeric: Operator[], string: Operator[] } = {
    numeric: ['>', '<', '=', '!='],
    string: ['=', '!=', 'contains', 'does not contain'],
};