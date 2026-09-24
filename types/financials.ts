export interface SolarProjectInput {
  systemCostCOP: number;               // Costo total de la inversión inicial (CAPEX)
  annualGenerationKWh: number;         // Generación estimada primer año
  currentEnergyTariffCOP: number;      // Tarifa de energía actual ($/kWh)
  energyTariffInflation: number;      // Inflación anual esperada de la tarifa (ej: 0.05 = 5%)
  degradationRate: number;            // Degradación anual de los paneles (ej: 0.005 = 0.5%)
  omCostAnnualCOP: number;             // Costos anuales de Operación y Mantenimiento (O&M)
  omInflation: number;                 // Inflación anual de O&M (ej: 0.04 = 4%)
  discountRate: number;               // Tasa de descuento / WACC (ej: 0.12 = 12%)
  projectLifespanYears: number;        // Vida útil del proyecto (usualmente 25 años)

  // Parámetros Tributarios Colombia (Ley 1715 / Ley 2099)
  companyTaxRate: number;              // Tasa de impuesto de renta de la empresa (ej: 0.35 = 35%)
  applyTaxDeduction: boolean;          // Deducción del 50% en renta
  deductionYears: number;              // Periodo para aplicar deducción (ej: 5 a 15 años)
  applyAcceleratedDepreciation: boolean;// Depreciación acelerada de activos
  depreciationYears: number;           // Años de depreciación (mínimo 3 años, ej: 3 o 5)
}

export interface YearCashFlow {
  year: number;
  generationKWh: number;
  tariffCOP: number;
  energySavingsCOP: number;
  omCostCOP: number;
  taxBenefitsCOP: number;
  netCashFlowCOP: number;
  cumulativeCashFlowCOP: number;
  discountedCashFlowCOP: number;
}

export interface FinancialMetrics {
  totalCapexCOP: number;
  totalTaxSavingsCOP: number;
  paybackYearsSimple: number;
  paybackYearsDiscounted: number;
  roiPercentage: number;
  npvCOP: number; // VAN - Valor Actual Neto
  irrPercentage: number; // TIR - Tasa Interna de Retorno
  cashFlows: YearCashFlow[];
}

/**
 * Calculadora Financiera de Proyectos Solares para Colombia
 */
export class ColombiaSolarFinancials {

  /**
   * Calcula el beneficio fiscal anual por deducción de renta (50% de la inversión)
   */
  private static calculateAnnualDeduction(
    capex: number,
    taxRate: number,
    years: number,
    currentYear: number
  ): number {
    if (currentYear > years) return 0;
    // 50% del CAPEX deducible en N años -> Ahorro real en impuesto = (50% CAPEX / N) * Tasa_Renta
    const maxDeductibleLimit = capex * 0.50;
    const annualDeduction = maxDeductibleLimit / years;
    return annualDeduction * taxRate;
  }

  /**
   * Calcula el ahorro por depreciación acelerada de activos
   */
  private static calculateAcceleratedDepreciation(
    capex: number,
    taxRate: number,
    years: number,
    currentYear: number
  ): number {
    if (currentYear > years) return 0;
    // Depreciación lineal acelerada
    const annualDepreciation = capex / years;
    return annualDepreciation * taxRate;
  }

  /**
   * Ejecuta la simulación financiera completa del proyecto
   */
  public static calculate(input: SolarProjectInput): FinancialMetrics {
    const cashFlows: YearCashFlow[] = [];
    let cumulativeCashFlow = -input.systemCostCOP;

    // Año 0: Inversión Inicial
    cashFlows.push({
      year: 0,
      generationKWh: 0,
      tariffCOP: input.currentEnergyTariffCOP,
      energySavingsCOP: 0,
      omCostCOP: 0,
      taxBenefitsCOP: 0,
      netCashFlowCOP: -input.systemCostCOP,
      cumulativeCashFlowCOP: -input.systemCostCOP,
      discountedCashFlowCOP: -input.systemCostCOP,
    });

    let totalTaxSavings = 0;

    // Proyección año a año
    for (let year = 1; year <= input.projectLifespanYears; year++) {
      // 1. Degradación de paneles y ajuste de tarifa con inflación
      const currentGeneration = input.annualGenerationKWh * Math.pow(1 - input.degradationRate, year - 1);
      const currentTariff = input.currentEnergyTariffCOP * Math.pow(1 + input.energyTariffInflation, year - 1);

      // 2. Ahorro bruto de energía
      const energySavings = currentGeneration * currentTariff;

      // 3. Costos de Operación y Mantenimiento
      const currentOmCost = input.omCostAnnualCOP * Math.pow(1 + input.omInflation, year - 1);

      // 4. Beneficios Fiscales Ley 1715 en Colombia
      let yearTaxBenefits = 0;

      if (input.applyTaxDeduction) {
        yearTaxBenefits += this.calculateAnnualDeduction(
          input.systemCostCOP,
          input.companyTaxRate,
          input.deductionYears,
          year
        );
      }

      if (input.applyAcceleratedDepreciation) {
        yearTaxBenefits += this.calculateAcceleratedDepreciation(
          input.systemCostCOP,
          input.companyTaxRate,
          input.depreciationYears,
          year
        );
      }

      totalTaxSavings += yearTaxBenefits;

      // 5. Flujo Neto del Año
      const netCashFlow = energySavings - currentOmCost + yearTaxBenefits;
      cumulativeCashFlow += netCashFlow;

      // Flujo Descontado (VPN)
      const discountedCashFlow = netCashFlow / Math.pow(1 + input.discountRate, year);

      cashFlows.push({
        year,
        generationKWh: Math.round(currentGeneration),
        tariffCOP: Math.round(currentTariff),
        energySavingsCOP: Math.round(energySavings),
        omCostCOP: Math.round(currentOmCost),
        taxBenefitsCOP: Math.round(yearTaxBenefits),
        netCashFlowCOP: Math.round(netCashFlow),
        cumulativeCashFlowCOP: Math.round(cumulativeCashFlow),
        discountedCashFlowCOP: Math.round(discountedCashFlow)
      });
    }

    // Cálculo de Payback Simple
    let paybackSimple = input.projectLifespanYears;
    for (let i = 1; i < cashFlows.length; i++) {
      if (cashFlows[i].cumulativeCashFlowCOP >= 0) {
        const prev = cashFlows[i - 1].cumulativeCashFlowCOP;
        const current = cashFlows[i].netCashFlowCOP;
        paybackSimple = (i - 1) + (Math.abs(prev) / current);
        break;
      }
    }

    // Cálculo de VAN / NPV
    const npv = cashFlows.reduce((acc, cf) => acc + cf.discountedCashFlowCOP, 0);

    // Cálculo de ROI Total %
    const totalNetProfit = cashFlows.slice(1).reduce((acc, cf) => acc + cf.netCashFlowCOP, 0);
    const roiPercentage = ((totalNetProfit - input.systemCostCOP) / input.systemCostCOP) * 100;

    // TIR (IRR) por Newton-Raphson sobre flujos netos
    const irrPercentage = this.calculateIRR(
      cashFlows.map((cf) => cf.netCashFlowCOP)
    );

    // Payback descontado
    let cumulativeDiscounted = 0;
    let paybackDiscounted = input.projectLifespanYears;
    for (let i = 0; i < cashFlows.length; i++) {
      cumulativeDiscounted += cashFlows[i].discountedCashFlowCOP;
      if (i > 0 && cumulativeDiscounted >= 0) {
        const prev = cumulativeDiscounted - cashFlows[i].discountedCashFlowCOP;
        paybackDiscounted =
          i - 1 + Math.abs(prev) / Math.abs(cashFlows[i].discountedCashFlowCOP);
        break;
      }
    }

    return {
      totalCapexCOP: input.systemCostCOP,
      totalTaxSavingsCOP: Math.round(totalTaxSavings),
      paybackYearsSimple: Number(paybackSimple.toFixed(2)),
      paybackYearsDiscounted: Number(paybackDiscounted.toFixed(2)),
      roiPercentage: Number(roiPercentage.toFixed(2)),
      npvCOP: Math.round(npv),
      irrPercentage: Number((irrPercentage * 100).toFixed(2)),
      cashFlows
    };
  }

  /**
   * TIR / IRR mediante Newton-Raphson. Retorna tasa decimal (ej. 0.18 = 18%).
   */
  private static calculateIRR(cashFlows: number[], guess = 0.1): number {
    let rate = guess;
    for (let iter = 0; iter < 100; iter++) {
      let npv = 0;
      let dNpv = 0;
      for (let t = 0; t < cashFlows.length; t++) {
        const denom = Math.pow(1 + rate, t);
        npv += cashFlows[t] / denom;
        if (t > 0) {
          dNpv -= (t * cashFlows[t]) / Math.pow(1 + rate, t + 1);
        }
      }
      if (Math.abs(dNpv) < 1e-12) break;
      const next = rate - npv / dNpv;
      if (!Number.isFinite(next)) break;
      if (Math.abs(next - rate) < 1e-7) {
        return next;
      }
      rate = next;
    }
    return Number.isFinite(rate) ? rate : 0;
  }
}
