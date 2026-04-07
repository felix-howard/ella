/**
 * OCR Prompts Index
 * Router for document-type specific OCR extraction prompts
 * Uses map-based routing for maintainability (~120 document types + generic fallback)
 */

// === EXISTING IMPORTS ===
import { getW2ExtractionPrompt as _getW2Prompt, validateW2Data as _validateW2, W2_FIELD_LABELS_VI as _W2Labels } from './w2'
import { get1099IntExtractionPrompt as _get1099IntPrompt, validate1099IntData as _validate1099Int, FORM_1099_INT_FIELD_LABELS_VI as _1099IntLabels } from './1099-int'
import { get1099NecExtractionPrompt as _get1099NecPrompt, validate1099NecData as _validate1099Nec, FORM_1099_NEC_FIELD_LABELS_VI as _1099NecLabels } from './1099-nec'
import { getSsnCardExtractionPrompt as _getSsnCardPrompt, validateSsnCardData as _validateSsnCard, SSN_CARD_FIELD_LABELS_VI as _SsnCardLabels, getDriverLicenseExtractionPrompt as _getDLPrompt, validateDriverLicenseData as _validateDL, DRIVER_LICENSE_FIELD_LABELS_VI as _DLLabels } from './ssn-dl'
import { get1099KExtractionPrompt as _get1099KPrompt, validate1099KData as _validate1099K, FORM_1099_K_FIELD_LABELS_VI as _1099KLabels } from './1099-k'
import { getScheduleK1ExtractionPrompt as _getK1Prompt, validateScheduleK1Data as _validateK1, SCHEDULE_K1_FIELD_LABELS_VI as _K1Labels } from './k-1'
import { getBankStatementExtractionPrompt as _getBankStatementPrompt, validateBankStatementData as _validateBankStatement, BANK_STATEMENT_FIELD_LABELS_VI as _BankStatementLabels } from './bank-statement'
import { get1099DivExtractionPrompt as _get1099DivPrompt, validate1099DivData as _validate1099Div, FORM_1099_DIV_FIELD_LABELS_VI as _1099DivLabels } from './1099-div'
import { get1099RExtractionPrompt as _get1099RPrompt, validate1099RData as _validate1099R, FORM_1099_R_FIELD_LABELS_VI as _1099RLabels } from './1099-r'
import { getSsa1099ExtractionPrompt as _getSsa1099Prompt, validateSsa1099Data as _validateSsa1099, FORM_SSA_1099_FIELD_LABELS_VI as _Ssa1099Labels } from './1099-ssa'
import { get1098ExtractionPrompt as _get1098Prompt, validate1098Data as _validate1098, FORM_1098_FIELD_LABELS_VI as _1098Labels } from './1098'
import { get1095AExtractionPrompt as _get1095APrompt, validate1095AData as _validate1095A, FORM_1095_A_FIELD_LABELS_VI as _1095ALabels } from './1095-a'
import { get1098TExtractionPrompt as _get1098TPrompt, validate1098TData as _validate1098T, FORM_1098_T_FIELD_LABELS_VI as _1098TLabels } from './1098-t'
import { get1099GExtractionPrompt as _get1099GPrompt, validate1099GData as _validate1099G, FORM_1099_G_FIELD_LABELS_VI as _1099GLabels } from './1099-g'
import { get1099MiscExtractionPrompt as _get1099MiscPrompt, validate1099MiscData as _validate1099Misc, FORM_1099_MISC_FIELD_LABELS_VI as _1099MiscLabels } from './1099-misc'
import { getForm1040ExtractionPrompt as _getForm1040Prompt, validateForm1040Data as _validateForm1040, FORM_1040_FIELD_LABELS_VI as _Form1040Labels } from './form-1040'
import { getSchedule1ExtractionPrompt as _getSchedule1Prompt, validateSchedule1Data as _validateSchedule1, SCHEDULE_1_FIELD_LABELS_VI as _Schedule1Labels } from './schedule-1'
import { getScheduleCExtractionPrompt as _getScheduleCPrompt, validateScheduleCData as _validateScheduleC, SCHEDULE_C_FIELD_LABELS_VI as _ScheduleCLabels } from './schedule-c'
import { getScheduleSEExtractionPrompt as _getScheduleSEPrompt, validateScheduleSEData as _validateScheduleSE, SCHEDULE_SE_FIELD_LABELS_VI as _ScheduleSELabels } from './schedule-se'
import { getScheduleDExtractionPrompt as _getScheduleDPrompt, validateScheduleDData as _validateScheduleD, SCHEDULE_D_FIELD_LABELS_VI as _ScheduleDLabels } from './schedule-d'
import { getScheduleEExtractionPrompt as _getScheduleEPrompt, validateScheduleEData as _validateScheduleE, SCHEDULE_E_FIELD_LABELS_VI as _ScheduleELabels } from './schedule-e'

// === PHASE 1: GENERIC FALLBACK ===
import { getGenericExtractionPrompt as _getGenericPrompt, validateGenericData as _validateGeneric, GENERIC_EXTRACTOR_FIELD_LABELS_VI as _GenericLabels } from './generic-extractor'

// === PHASE 2: 1099 VARIANTS ===
import { get1099BExtractionPrompt as _get1099BPrompt, validate1099BData as _validate1099B, FORM_1099_B_FIELD_LABELS_VI as _1099BLabels } from './1099-b'
import { get1099SExtractionPrompt as _get1099SPrompt, validate1099SData as _validate1099S, FORM_1099_S_FIELD_LABELS_VI as _1099SLabels } from './1099-s'
import { get1099CExtractionPrompt as _get1099CPrompt, validate1099CData as _validate1099C, FORM_1099_C_FIELD_LABELS_VI as _1099CLabels } from './1099-c'
import { get1099SAExtractionPrompt as _get1099SAPrompt, validate1099SAData as _validate1099SA, FORM_1099_SA_FIELD_LABELS_VI as _1099SALabels } from './1099-sa'
import { get1099QExtractionPrompt as _get1099QPrompt, validate1099QData as _validate1099Q, FORM_1099_Q_FIELD_LABELS_VI as _1099QLabels } from './1099-q'
import { get1099AExtractionPrompt as _get1099APrompt, validate1099AData as _validate1099A, FORM_1099_A_FIELD_LABELS_VI as _1099ALabels } from './1099-a'
import { get1099OIDExtractionPrompt as _get1099OIDPrompt, validate1099OIDData as _validate1099OID, FORM_1099_OID_FIELD_LABELS_VI as _1099OIDLabels } from './1099-oid'
import { get1099LTCExtractionPrompt as _get1099LTCPrompt, validate1099LTCData as _validate1099LTC, FORM_1099_LTC_FIELD_LABELS_VI as _1099LTCLabels } from './1099-ltc'
import { get1099PATRExtractionPrompt as _get1099PATRPrompt, validate1099PATRData as _validate1099PATR, FORM_1099_PATR_FIELD_LABELS_VI as _1099PATRLabels } from './1099-patr'
import { get1099CAPExtractionPrompt as _get1099CAPPrompt, validate1099CAPData as _validate1099CAP, FORM_1099_CAP_FIELD_LABELS_VI as _1099CAPLabels } from './1099-cap'
import { get1099HExtractionPrompt as _get1099HPrompt, validate1099HData as _validate1099H, FORM_1099_H_FIELD_LABELS_VI as _1099HLabels } from './1099-h'
import { get1099LSExtractionPrompt as _get1099LSPrompt, validate1099LSData as _validate1099LS, FORM_1099_LS_FIELD_LABELS_VI as _1099LSLabels } from './1099-ls'
import { get1099QAExtractionPrompt as _get1099QAPrompt, validate1099QAData as _validate1099QA, FORM_1099_QA_FIELD_LABELS_VI as _1099QALabels } from './1099-qa'
import { get1099SBExtractionPrompt as _get1099SBPrompt, validate1099SBData as _validate1099SB, FORM_1099_SB_FIELD_LABELS_VI as _1099SBLabels } from './1099-sb'
import { getRRB1099ExtractionPrompt as _getRRB1099Prompt, validateRRB1099Data as _validateRRB1099, RRB_1099_FIELD_LABELS_VI as _RRB1099Labels } from './rrb-1099'
import { getRRB1099RExtractionPrompt as _getRRB1099RPrompt, validateRRB1099RData as _validateRRB1099R, RRB_1099_R_FIELD_LABELS_VI as _RRB1099RLabels } from './rrb-1099-r'

// === PHASE 3: SCHEDULES ===
import { getSchedule2ExtractionPrompt as _getSchedule2Prompt, validateSchedule2Data as _validateSchedule2, SCHEDULE_2_FIELD_LABELS_VI as _Schedule2Labels } from './schedule-2'
import { getSchedule3ExtractionPrompt as _getSchedule3Prompt, validateSchedule3Data as _validateSchedule3, SCHEDULE_3_FIELD_LABELS_VI as _Schedule3Labels } from './schedule-3'
import { getScheduleAExtractionPrompt as _getScheduleAPrompt, validateScheduleAData as _validateScheduleA, SCHEDULE_A_FIELD_LABELS_VI as _ScheduleALabels } from './schedule-a'
import { getScheduleBExtractionPrompt as _getScheduleBPrompt, validateScheduleBData as _validateScheduleB, SCHEDULE_B_FIELD_LABELS_VI as _ScheduleBLabels } from './schedule-b'
import { getSchedule8812ExtractionPrompt as _getSchedule8812Prompt, validateSchedule8812Data as _validateSchedule8812, SCHEDULE_8812_FIELD_LABELS_VI as _Schedule8812Labels } from './schedule-8812'
import { getScheduleEICExtractionPrompt as _getScheduleEICPrompt, validateScheduleEICData as _validateScheduleEIC, SCHEDULE_EIC_FIELD_LABELS_VI as _ScheduleEICLabels } from './schedule-eic'
import { getScheduleFExtractionPrompt as _getScheduleFPrompt, validateScheduleFData as _validateScheduleF, SCHEDULE_F_FIELD_LABELS_VI as _ScheduleFLabels } from './schedule-f'
import { getScheduleHExtractionPrompt as _getScheduleHPrompt, validateScheduleHData as _validateScheduleH, SCHEDULE_H_FIELD_LABELS_VI as _ScheduleHLabels } from './schedule-h'
import { getScheduleJExtractionPrompt as _getScheduleJPrompt, validateScheduleJData as _validateScheduleJ, SCHEDULE_J_FIELD_LABELS_VI as _ScheduleJLabels } from './schedule-j'
import { getScheduleRExtractionPrompt as _getScheduleRPrompt, validateScheduleRData as _validateScheduleR, SCHEDULE_R_FIELD_LABELS_VI as _ScheduleRLabels } from './schedule-r'

// === PHASE 4: K-1 VARIANTS + HEALTH/EDUCATION ===
import { getK1_1065ExtractionPrompt as _getK1_1065Prompt, validateK1_1065Data as _validateK1_1065, SCHEDULE_K1_1065_FIELD_LABELS_VI as _K1_1065Labels } from './k1-1065'
import { getK1_1120SExtractionPrompt as _getK1_1120SPrompt, validateK1_1120SData as _validateK1_1120S, SCHEDULE_K1_1120S_FIELD_LABELS_VI as _K1_1120SLabels } from './k1-1120s'
import { getK1_1041ExtractionPrompt as _getK1_1041Prompt, validateK1_1041Data as _validateK1_1041, SCHEDULE_K1_1041_FIELD_LABELS_VI as _K1_1041Labels } from './k1-1041'
import { get1095BExtractionPrompt as _get1095BPrompt, validate1095BData as _validate1095B, FORM_1095_B_FIELD_LABELS_VI as _1095BLabels } from './1095-b'
import { get1095CExtractionPrompt as _get1095CPrompt, validate1095CData as _validate1095C, FORM_1095_C_FIELD_LABELS_VI as _1095CLabels } from './1095-c'
import { get5498SAExtractionPrompt as _get5498SAPrompt, validate5498SAData as _validate5498SA, FORM_5498_SA_FIELD_LABELS_VI as _5498SALabels } from './5498-sa'
import { get1098EExtractionPrompt as _get1098EPrompt, validate1098EData as _validate1098E, FORM_1098_E_FIELD_LABELS_VI as _1098ELabels } from './1098-e'
import { get8332ExtractionPrompt as _get8332Prompt, validate8332Data as _validate8332, FORM_8332_FIELD_LABELS_VI as _8332Labels } from './8332'

// === PHASE 5: IRS FORMS PART 1 ===
import { getForm2441ExtractionPrompt as _getForm2441Prompt, validateForm2441Data as _validateForm2441, FORM_2441_FIELD_LABELS_VI as _Form2441Labels } from './form-2441'
import { getForm4562ExtractionPrompt as _getForm4562Prompt, validateForm4562Data as _validateForm4562, FORM_4562_FIELD_LABELS_VI as _Form4562Labels } from './form-4562'
import { getForm4797ExtractionPrompt as _getForm4797Prompt, validateForm4797Data as _validateForm4797, FORM_4797_FIELD_LABELS_VI as _Form4797Labels } from './form-4797'
import { getForm5695ExtractionPrompt as _getForm5695Prompt, validateForm5695Data as _validateForm5695, FORM_5695_FIELD_LABELS_VI as _Form5695Labels } from './form-5695'
import { getForm8283ExtractionPrompt as _getForm8283Prompt, validateForm8283Data as _validateForm8283, FORM_8283_FIELD_LABELS_VI as _Form8283Labels } from './form-8283'
import { getForm8606ExtractionPrompt as _getForm8606Prompt, validateForm8606Data as _validateForm8606, FORM_8606_FIELD_LABELS_VI as _Form8606Labels } from './form-8606'
import { getForm8829ExtractionPrompt as _getForm8829Prompt, validateForm8829Data as _validateForm8829, FORM_8829_FIELD_LABELS_VI as _Form8829Labels } from './form-8829'
import { getForm8863ExtractionPrompt as _getForm8863Prompt, validateForm8863Data as _validateForm8863, FORM_8863_FIELD_LABELS_VI as _Form8863Labels } from './form-8863'
import { getForm8889ExtractionPrompt as _getForm8889Prompt, validateForm8889Data as _validateForm8889, FORM_8889_FIELD_LABELS_VI as _Form8889Labels } from './form-8889'
import { getForm8949ExtractionPrompt as _getForm8949Prompt, validateForm8949Data as _validateForm8949, FORM_8949_FIELD_LABELS_VI as _Form8949Labels } from './form-8949'
import { getForm8959ExtractionPrompt as _getForm8959Prompt, validateForm8959Data as _validateForm8959, FORM_8959_FIELD_LABELS_VI as _Form8959Labels } from './form-8959'
import { getForm8960ExtractionPrompt as _getForm8960Prompt, validateForm8960Data as _validateForm8960, FORM_8960_FIELD_LABELS_VI as _Form8960Labels } from './form-8960'
import { getForm8995ExtractionPrompt as _getForm8995Prompt, validateForm8995Data as _validateForm8995, FORM_8995_FIELD_LABELS_VI as _Form8995Labels } from './form-8995'

// === PHASE 6: IRS FORMS PART 2 ===
import { getForm8995AExtractionPrompt as _getForm8995APrompt, validateForm8995AData as _validateForm8995A, FORM_8995A_FIELD_LABELS_VI as _Form8995ALabels } from './form-8995-a'
import { getW2GExtractionPrompt as _getW2GPrompt, validateW2GData as _validateW2G, W2G_FIELD_LABELS_VI as _W2GLabels } from './w2g'
import { getForm2210ExtractionPrompt as _getForm2210Prompt, validateForm2210Data as _validateForm2210, FORM_2210_FIELD_LABELS_VI as _Form2210Labels } from './form-2210'
import { getForm3903ExtractionPrompt as _getForm3903Prompt, validateForm3903Data as _validateForm3903, FORM_3903_FIELD_LABELS_VI as _Form3903Labels } from './form-3903'
import { getForm4684ExtractionPrompt as _getForm4684Prompt, validateForm4684Data as _validateForm4684, FORM_4684_FIELD_LABELS_VI as _Form4684Labels } from './form-4684'
import { getForm4868ExtractionPrompt as _getForm4868Prompt, validateForm4868Data as _validateForm4868, FORM_4868_FIELD_LABELS_VI as _Form4868Labels } from './form-4868'
import { getForm8936ExtractionPrompt as _getForm8936Prompt, validateForm8936Data as _validateForm8936, FORM_8936_FIELD_LABELS_VI as _Form8936Labels } from './form-8936'
import { getFormW9ExtractionPrompt as _getFormW9Prompt, validateFormW9Data as _validateFormW9, FORM_W9_FIELD_LABELS_VI as _FormW9Labels } from './form-w9'
import { getForm6251ExtractionPrompt as _getForm6251Prompt, validateForm6251Data as _validateForm6251, FORM_6251_FIELD_LABELS_VI as _Form6251Labels } from './form-6251'
import { getForm2555ExtractionPrompt as _getForm2555Prompt, validateForm2555Data as _validateForm2555, FORM_2555_FIELD_LABELS_VI as _Form2555Labels } from './form-2555'
import { getForm5329ExtractionPrompt as _getForm5329Prompt, validateForm5329Data as _validateForm5329, FORM_5329_FIELD_LABELS_VI as _Form5329Labels } from './form-5329'
import { getForm8379ExtractionPrompt as _getForm8379Prompt, validateForm8379Data as _validateForm8379, FORM_8379_FIELD_LABELS_VI as _Form8379Labels } from './form-8379'
import { getForm8582ExtractionPrompt as _getForm8582Prompt, validateForm8582Data as _validateForm8582, FORM_8582_FIELD_LABELS_VI as _Form8582Labels } from './form-8582'
import { getForm8880ExtractionPrompt as _getForm8880Prompt, validateForm8880Data as _validateForm8880, FORM_8880_FIELD_LABELS_VI as _Form8880Labels } from './form-8880'
import { getForm8962ExtractionPrompt as _getForm8962Prompt, validateForm8962Data as _validateForm8962, FORM_8962_FIELD_LABELS_VI as _Form8962Labels } from './form-8962'
import { getForm8938ExtractionPrompt as _getForm8938Prompt, validateForm8938Data as _validateForm8938, FORM_8938_FIELD_LABELS_VI as _Form8938Labels } from './form-8938'

// === PHASE 7: TAX RETURNS ===
import { getForm1040SRExtractionPrompt as _getForm1040SRPrompt, validateForm1040SRData as _validateForm1040SR, FORM_1040_SR_FIELD_LABELS_VI as _Form1040SRLabels } from './form-1040-sr'
import { getForm1040NRExtractionPrompt as _getForm1040NRPrompt, validateForm1040NRData as _validateForm1040NR, FORM_1040_NR_FIELD_LABELS_VI as _Form1040NRLabels } from './form-1040-nr'
import { getForm1040XExtractionPrompt as _getForm1040XPrompt, validateForm1040XData as _validateForm1040X, FORM_1040_X_FIELD_LABELS_VI as _Form1040XLabels } from './form-1040-x'
import { getStateTaxReturnExtractionPrompt as _getStateTaxReturnPrompt, validateStateTaxReturnData as _validateStateTaxReturn, STATE_TAX_RETURN_FIELD_LABELS_VI as _StateTaxReturnLabels } from './state-tax-return'

// === PHASE 8: SEMI-STRUCTURED DOCUMENTS ===
import { getItinLetterExtractionPrompt as _getItinLetterPrompt, validateItinLetterData as _validateItinLetter, ITIN_LETTER_FIELD_LABELS_VI as _ItinLetterLabels } from './itin-letter'
import { getPayStubExtractionPrompt as _getPayStubPrompt, validatePayStubData as _validatePayStub, PAY_STUB_FIELD_LABELS_VI as _PayStubLabels } from './pay-stub'
import { getGreenCardExtractionPrompt as _getGreenCardPrompt, validateGreenCardData as _validateGreenCard, GREEN_CARD_FIELD_LABELS_VI as _GreenCardLabels } from './green-card'
import { getStockOptionAgreementExtractionPrompt as _getStockOptionPrompt, validateStockOptionAgreementData as _validateStockOption, STOCK_OPTION_AGREEMENT_FIELD_LABELS_VI as _StockOptionLabels } from './stock-option-agreement'
import { getRsuStatementExtractionPrompt as _getRsuPrompt, validateRsuStatementData as _validateRsu, RSU_STATEMENT_FIELD_LABELS_VI as _RsuLabels } from './rsu-statement'
import { getNaturalizationCertificateExtractionPrompt as _getNaturalizationPrompt, validateNaturalizationCertificateData as _validateNaturalization, NATURALIZATION_CERTIFICATE_FIELD_LABELS_VI as _NaturalizationLabels } from './naturalization-certificate'
import { getBrokerageStatementExtractionPrompt as _getBrokeragePrompt, validateBrokerageStatementData as _validateBrokerage, BROKERAGE_STATEMENT_FIELD_LABELS_VI as _BrokerageLabels } from './brokerage-statement'
import { getPropertyTaxStatementExtractionPrompt as _getPropertyTaxPrompt, validatePropertyTaxStatementData as _validatePropertyTax, PROPERTY_TAX_STATEMENT_FIELD_LABELS_VI as _PropertyTaxLabels } from './property-tax-statement'
import { getEsppStatementExtractionPrompt as _getEsppPrompt, validateEsppStatementData as _validateEspp, ESPP_STATEMENT_FIELD_LABELS_VI as _EsppLabels } from './espp-statement'
import { getWorkVisaExtractionPrompt as _getWorkVisaPrompt, validateWorkVisaData as _validateWorkVisa, WORK_VISA_FIELD_LABELS_VI as _WorkVisaLabels } from './work-visa'
import { getMarriageCertificateExtractionPrompt as _getMarriageCertPrompt, validateMarriageCertificateData as _validateMarriageCert, MARRIAGE_CERTIFICATE_FIELD_LABELS_VI as _MarriageCertLabels } from './marriage-certificate'
import { getDivorceDecreeExtractionPrompt as _getDivorcePrompt, validateDivorceDecreeData as _validateDivorce, DIVORCE_DECREE_FIELD_LABELS_VI as _DivorceLabels } from './divorce-decree'
import { getPowerOfAttorneyExtractionPrompt as _getPowerOfAttorneyPrompt, validatePowerOfAttorneyData as _validatePowerOfAttorney, POWER_OF_ATTORNEY_FIELD_LABELS_VI as _PowerOfAttorneyLabels } from './power-of-attorney'
import { getClosingDisclosureExtractionPrompt as _getClosingDisclosurePrompt, validateClosingDisclosureData as _validateClosingDisclosure, CLOSING_DISCLOSURE_FIELD_LABELS_VI as _ClosingDisclosureLabels } from './closing-disclosure'
import { getHud1ExtractionPrompt as _getHud1Prompt, validateHud1Data as _validateHud1, HUD_1_FIELD_LABELS_VI as _Hud1Labels } from './hud-1'
import { getPmiStatementExtractionPrompt as _getPmiPrompt, validatePmiStatementData as _validatePmi, PMI_STATEMENT_FIELD_LABELS_VI as _PmiLabels } from './pmi-statement'
import { getMortgagePointsStatementExtractionPrompt as _getMortgagePointsPrompt, validateMortgagePointsStatementData as _validateMortgagePoints, MORTGAGE_POINTS_STATEMENT_FIELD_LABELS_VI as _MortgagePointsLabels } from './mortgage-points-statement'
import { getEstimatedTaxPaymentExtractionPrompt as _getEstimatedTaxPrompt, validateEstimatedTaxPaymentData as _validateEstimatedTax, ESTIMATED_TAX_PAYMENT_FIELD_LABELS_VI as _EstimatedTaxLabels } from './estimated-tax-payment'
import { getExtensionPaymentProofExtractionPrompt as _getExtensionProofPrompt, validateExtensionPaymentProofData as _validateExtensionProof, EXTENSION_PAYMENT_PROOF_FIELD_LABELS_VI as _ExtensionProofLabels } from './extension-payment-proof'
import { getPriorYearReturnExtractionPrompt as _getPriorYearPrompt, validatePriorYearReturnData as _validatePriorYear, PRIOR_YEAR_RETURN_FIELD_LABELS_VI as _PriorYearLabels } from './prior-year-return'
import { getCryptoTaxReportExtractionPrompt as _getCryptoTaxPrompt, validateCryptoTaxReportData as _validateCryptoTax, CRYPTO_TAX_REPORT_FIELD_LABELS_VI as _CryptoTaxLabels } from './crypto-tax-report'
import { getForeignBankStatementExtractionPrompt as _getForeignBankPrompt, validateForeignBankStatementData as _validateForeignBank, FOREIGN_BANK_STATEMENT_FIELD_LABELS_VI as _ForeignBankLabels } from './foreign-bank-statement'
import { getForeignTaxStatementExtractionPrompt as _getForeignTaxPrompt, validateForeignTaxStatementData as _validateForeignTax, FOREIGN_TAX_STATEMENT_FIELD_LABELS_VI as _ForeignTaxLabels } from './foreign-tax-statement'
import { getBalanceSheetExtractionPrompt as _getBalanceSheetPrompt, validateBalanceSheetData as _validateBalanceSheet, BALANCE_SHEET_FIELD_LABELS_VI as _BalanceSheetLabels } from './balance-sheet'
import { getPayrollReportExtractionPrompt as _getPayrollPrompt, validatePayrollReportData as _validatePayroll, PAYROLL_REPORT_FIELD_LABELS_VI as _PayrollLabels } from './payroll-report'
import { getDepreciationScheduleExtractionPrompt as _getDepreciationPrompt, validateDepreciationScheduleData as _validateDepreciation, DEPRECIATION_SCHEDULE_FIELD_LABELS_VI as _DepreciationLabels } from './depreciation-schedule'
import { getPensionStatementExtractionPrompt as _getPensionPrompt, validatePensionStatementData as _validatePension, PENSION_STATEMENT_FIELD_LABELS_VI as _PensionLabels } from './pension-statement'
import { getIraStatementExtractionPrompt as _getIraPrompt, validateIraStatementData as _validateIra, IRA_STATEMENT_FIELD_LABELS_VI as _IraLabels } from './ira-statement'
import { get401kStatementExtractionPrompt as _get401kPrompt, validate401kStatementData as _validate401k, STATEMENT_401K_FIELD_LABELS_VI as _401kLabels } from './statement-401k'
import { getRothIraStatementExtractionPrompt as _getRothIraPrompt, validateRothIraStatementData as _validateRothIra, ROTH_IRA_STATEMENT_FIELD_LABELS_VI as _RothIraLabels } from './roth-ira-statement'
import { getRmdStatementExtractionPrompt as _getRmdPrompt, validateRmdStatementData as _validateRmd, RMD_STATEMENT_FIELD_LABELS_VI as _RmdLabels } from './rmd-statement'
import { getHsaStatementExtractionPrompt as _getHsaPrompt, validateHsaStatementData as _validateHsa, HSA_STATEMENT_FIELD_LABELS_VI as _HsaLabels } from './hsa-statement'
import { getFsaStatementExtractionPrompt as _getFsaPrompt, validateFsaStatementData as _validateFsa, FSA_STATEMENT_FIELD_LABELS_VI as _FsaLabels } from './fsa-statement'
import { getDaycareStatementExtractionPrompt as _getDaycarePrompt, validateDaycareStatementData as _validateDaycare, DAYCARE_STATEMENT_FIELD_LABELS_VI as _DaycareLabels } from './daycare-statement'
import { getDependentCareFsaExtractionPrompt as _getDependentCareFsaPrompt, validateDependentCareFsaData as _validateDependentCareFsa, DEPENDENT_CARE_FSA_FIELD_LABELS_VI as _DependentCareFsaLabels } from './dependent-care-fsa'

// ============================================================================
// RE-EXPORTS (existing - for backward compatibility)
// ============================================================================
export { getW2ExtractionPrompt, validateW2Data, W2_FIELD_LABELS_VI } from './w2'
export type { W2ExtractedData } from './w2'
export { get1099IntExtractionPrompt, validate1099IntData, FORM_1099_INT_FIELD_LABELS_VI } from './1099-int'
export type { Form1099IntExtractedData } from './1099-int'
export { get1099NecExtractionPrompt, validate1099NecData, FORM_1099_NEC_FIELD_LABELS_VI } from './1099-nec'
export type { Form1099NecExtractedData } from './1099-nec'
export { getSsnCardExtractionPrompt, validateSsnCardData, SSN_CARD_FIELD_LABELS_VI, getDriverLicenseExtractionPrompt, validateDriverLicenseData, DRIVER_LICENSE_FIELD_LABELS_VI } from './ssn-dl'
export type { SsnCardExtractedData, DriverLicenseExtractedData } from './ssn-dl'
export { get1099KExtractionPrompt, validate1099KData, FORM_1099_K_FIELD_LABELS_VI } from './1099-k'
export type { Form1099KExtractedData } from './1099-k'
export { getScheduleK1ExtractionPrompt, validateScheduleK1Data, SCHEDULE_K1_FIELD_LABELS_VI } from './k-1'
export type { ScheduleK1ExtractedData } from './k-1'
export { getBankStatementExtractionPrompt, validateBankStatementData, BANK_STATEMENT_FIELD_LABELS_VI } from './bank-statement'
export type { BankStatementExtractedData } from './bank-statement'
export { get1099DivExtractionPrompt, validate1099DivData, FORM_1099_DIV_FIELD_LABELS_VI } from './1099-div'
export type { Form1099DivExtractedData } from './1099-div'
export { get1099RExtractionPrompt, validate1099RData, FORM_1099_R_FIELD_LABELS_VI } from './1099-r'
export type { Form1099RExtractedData } from './1099-r'
export { getSsa1099ExtractionPrompt, validateSsa1099Data, FORM_SSA_1099_FIELD_LABELS_VI } from './1099-ssa'
export type { FormSsa1099ExtractedData } from './1099-ssa'
export { get1098ExtractionPrompt, validate1098Data, FORM_1098_FIELD_LABELS_VI } from './1098'
export type { Form1098ExtractedData } from './1098'
export { get1095AExtractionPrompt, validate1095AData, FORM_1095_A_FIELD_LABELS_VI } from './1095-a'
export type { Form1095AExtractedData } from './1095-a'
export { get1098TExtractionPrompt, validate1098TData, FORM_1098_T_FIELD_LABELS_VI } from './1098-t'
export type { Form1098TExtractedData } from './1098-t'
export { get1099GExtractionPrompt, validate1099GData, FORM_1099_G_FIELD_LABELS_VI } from './1099-g'
export type { Form1099GExtractedData } from './1099-g'
export { get1099MiscExtractionPrompt, validate1099MiscData, FORM_1099_MISC_FIELD_LABELS_VI } from './1099-misc'
export type { Form1099MiscExtractedData } from './1099-misc'
export { getForm1040ExtractionPrompt, validateForm1040Data, FORM_1040_FIELD_LABELS_VI } from './form-1040'
export type { Form1040ExtractedData, TaxpayerAddress, DependentInfo } from './form-1040'
export { getSchedule1ExtractionPrompt, validateSchedule1Data, SCHEDULE_1_FIELD_LABELS_VI } from './schedule-1'
export type { Schedule1ExtractedData } from './schedule-1'
export { getScheduleCExtractionPrompt, validateScheduleCData, SCHEDULE_C_FIELD_LABELS_VI } from './schedule-c'
export type { ScheduleCExtractedData } from './schedule-c'
export { getScheduleSEExtractionPrompt, validateScheduleSEData, SCHEDULE_SE_FIELD_LABELS_VI } from './schedule-se'
export type { ScheduleSEExtractedData } from './schedule-se'
export { getScheduleDExtractionPrompt, validateScheduleDData, SCHEDULE_D_FIELD_LABELS_VI } from './schedule-d'
export type { ScheduleDExtractedData } from './schedule-d'
export { getScheduleEExtractionPrompt, validateScheduleEData, SCHEDULE_E_FIELD_LABELS_VI } from './schedule-e'
export type { ScheduleEExtractedData, RentalPropertyDetail, PartnershipDetail, EstateTrustDetail } from './schedule-e'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Supported OCR document types (known types + string fallback for generic extractor)
 */
export type OcrDocType =
  // Existing
  | 'W2'
  | 'FORM_1099_INT'
  | 'FORM_1099_NEC'
  | 'FORM_1099_DIV'
  | 'FORM_1099_K'
  | 'FORM_1099_R'
  | 'FORM_1099_SSA'
  | 'FORM_1099_G'
  | 'FORM_1099_MISC'
  | 'FORM_1098'
  | 'FORM_1098_T'
  | 'FORM_1095_A'
  | 'SCHEDULE_K1'
  | 'SCHEDULE_1'
  | 'SCHEDULE_C'
  | 'SCHEDULE_SE'
  | 'SCHEDULE_D'
  | 'SCHEDULE_E'
  | 'BANK_STATEMENT'
  | 'SSN_CARD'
  | 'DRIVER_LICENSE'
  | 'FORM_1040'
  // Phase 2: 1099 Variants
  | 'FORM_1099_B'
  | 'FORM_1099_S'
  | 'FORM_1099_C'
  | 'FORM_1099_SA'
  | 'FORM_1099_Q'
  | 'FORM_1099_A'
  | 'FORM_1099_OID'
  | 'FORM_1099_LTC'
  | 'FORM_1099_PATR'
  | 'FORM_1099_CAP'
  | 'FORM_1099_H'
  | 'FORM_1099_LS'
  | 'FORM_1099_QA'
  | 'FORM_1099_SB'
  | 'RRB_1099'
  | 'RRB_1099_R'
  // Phase 3: Schedules
  | 'SCHEDULE_2'
  | 'SCHEDULE_3'
  | 'SCHEDULE_A'
  | 'SCHEDULE_B'
  | 'SCHEDULE_8812'
  | 'SCHEDULE_EIC'
  | 'SCHEDULE_F'
  | 'SCHEDULE_H'
  | 'SCHEDULE_J'
  | 'SCHEDULE_R'
  // Phase 4: K-1 Variants + Health/Education
  | 'SCHEDULE_K1_1065'
  | 'SCHEDULE_K1_1120S'
  | 'SCHEDULE_K1_1041'
  | 'FORM_1095_B'
  | 'FORM_1095_C'
  | 'FORM_5498_SA'
  | 'FORM_1098_E'
  | 'FORM_8332'
  // Phase 5-6: IRS Forms
  | 'FORM_2441'
  | 'FORM_4562'
  | 'FORM_4797'
  | 'FORM_5695'
  | 'FORM_8283'
  | 'FORM_8606'
  | 'FORM_8829'
  | 'FORM_8863'
  | 'FORM_8889'
  | 'FORM_8949'
  | 'FORM_8959'
  | 'FORM_8960'
  | 'FORM_8995'
  | 'FORM_8995_A'
  | 'W2G'
  | 'FORM_2210'
  | 'FORM_3903'
  | 'FORM_4684'
  | 'FORM_4868'
  | 'FORM_8936'
  | 'FORM_W9_ISSUED'
  | 'FORM_6251'
  | 'FORM_2555'
  | 'FORM_5329'
  | 'FORM_8379'
  | 'FORM_8582'
  | 'FORM_8880'
  | 'FORM_8962'
  | 'FORM_8938'
  // Phase 7: Tax Returns
  | 'FORM_1040_SR'
  | 'FORM_1040_NR'
  | 'FORM_1040_X'
  | 'STATE_TAX_RETURN'
  // Phase 8: Semi-Structured Documents
  | 'ITIN_LETTER'
  | 'PAY_STUB'
  | 'GREEN_CARD'
  | 'STOCK_OPTION_AGREEMENT'
  | 'RSU_STATEMENT'
  | 'NATURALIZATION_CERTIFICATE'
  | 'BROKERAGE_STATEMENT'
  | 'PROPERTY_TAX_STATEMENT'
  | 'ESPP_STATEMENT'
  | 'WORK_VISA'
  | 'MARRIAGE_CERTIFICATE'
  | 'DIVORCE_DECREE'
  | 'POWER_OF_ATTORNEY'
  | 'CLOSING_DISCLOSURE'
  | 'HUD_1'
  | 'PMI_STATEMENT'
  | 'MORTGAGE_POINTS_STATEMENT'
  | 'ESTIMATED_TAX_PAYMENT'
  | 'EXTENSION_PAYMENT_PROOF'
  | 'PRIOR_YEAR_RETURN'
  | 'CRYPTO_TAX_REPORT'
  | 'FOREIGN_BANK_STATEMENT'
  | 'FOREIGN_TAX_STATEMENT'
  | 'BALANCE_SHEET'
  | 'PAYROLL_REPORT'
  | 'DEPRECIATION_SCHEDULE'
  | 'PENSION_STATEMENT'
  | 'IRA_STATEMENT'
  | 'STATEMENT_401K'
  | 'ROTH_IRA_STATEMENT'
  | 'RMD_STATEMENT'
  | 'HSA_STATEMENT'
  | 'FSA_STATEMENT'
  | 'DAYCARE_STATEMENT'
  | 'DEPENDENT_CARE_FSA'

// ============================================================================
// ROUTING MAPS (map-based routing for maintainability)
// ============================================================================

/** Prompt getter functions by document type */
const promptGetters: Record<string, () => string> = {
  // Existing
  W2: _getW2Prompt,
  FORM_1099_INT: _get1099IntPrompt,
  FORM_1099_NEC: _get1099NecPrompt,
  FORM_1099_K: _get1099KPrompt,
  FORM_1099_DIV: _get1099DivPrompt,
  FORM_1099_R: _get1099RPrompt,
  FORM_1099_SSA: _getSsa1099Prompt,
  FORM_1098: _get1098Prompt,
  FORM_1095_A: _get1095APrompt,
  FORM_1098_T: _get1098TPrompt,
  FORM_1099_G: _get1099GPrompt,
  FORM_1099_MISC: _get1099MiscPrompt,
  SCHEDULE_K1: _getK1Prompt,
  BANK_STATEMENT: _getBankStatementPrompt,
  SSN_CARD: _getSsnCardPrompt,
  DRIVER_LICENSE: _getDLPrompt,
  FORM_1040: _getForm1040Prompt,
  SCHEDULE_1: _getSchedule1Prompt,
  SCHEDULE_C: _getScheduleCPrompt,
  SCHEDULE_SE: _getScheduleSEPrompt,
  SCHEDULE_D: _getScheduleDPrompt,
  SCHEDULE_E: _getScheduleEPrompt,
  // Phase 2: 1099 Variants
  FORM_1099_B: _get1099BPrompt,
  FORM_1099_S: _get1099SPrompt,
  FORM_1099_C: _get1099CPrompt,
  FORM_1099_SA: _get1099SAPrompt,
  FORM_1099_Q: _get1099QPrompt,
  FORM_1099_A: _get1099APrompt,
  FORM_1099_OID: _get1099OIDPrompt,
  FORM_1099_LTC: _get1099LTCPrompt,
  FORM_1099_PATR: _get1099PATRPrompt,
  FORM_1099_CAP: _get1099CAPPrompt,
  FORM_1099_H: _get1099HPrompt,
  FORM_1099_LS: _get1099LSPrompt,
  FORM_1099_QA: _get1099QAPrompt,
  FORM_1099_SB: _get1099SBPrompt,
  RRB_1099: _getRRB1099Prompt,
  RRB_1099_R: _getRRB1099RPrompt,
  // Phase 3: Schedules
  SCHEDULE_2: _getSchedule2Prompt,
  SCHEDULE_3: _getSchedule3Prompt,
  SCHEDULE_A: _getScheduleAPrompt,
  SCHEDULE_B: _getScheduleBPrompt,
  SCHEDULE_8812: _getSchedule8812Prompt,
  SCHEDULE_EIC: _getScheduleEICPrompt,
  SCHEDULE_F: _getScheduleFPrompt,
  SCHEDULE_H: _getScheduleHPrompt,
  SCHEDULE_J: _getScheduleJPrompt,
  SCHEDULE_R: _getScheduleRPrompt,
  // Phase 4: K-1 Variants + Health/Education
  SCHEDULE_K1_1065: _getK1_1065Prompt,
  SCHEDULE_K1_1120S: _getK1_1120SPrompt,
  SCHEDULE_K1_1041: _getK1_1041Prompt,
  FORM_1095_B: _get1095BPrompt,
  FORM_1095_C: _get1095CPrompt,
  FORM_5498_SA: _get5498SAPrompt,
  FORM_1098_E: _get1098EPrompt,
  FORM_8332: _get8332Prompt,
  // Phase 5: IRS Forms Part 1
  FORM_2441: _getForm2441Prompt,
  FORM_4562: _getForm4562Prompt,
  FORM_4797: _getForm4797Prompt,
  FORM_5695: _getForm5695Prompt,
  FORM_8283: _getForm8283Prompt,
  FORM_8606: _getForm8606Prompt,
  FORM_8829: _getForm8829Prompt,
  FORM_8863: _getForm8863Prompt,
  FORM_8889: _getForm8889Prompt,
  FORM_8949: _getForm8949Prompt,
  FORM_8959: _getForm8959Prompt,
  FORM_8960: _getForm8960Prompt,
  FORM_8995: _getForm8995Prompt,
  // Phase 6: IRS Forms Part 2
  FORM_8995_A: _getForm8995APrompt,
  W2G: _getW2GPrompt,
  FORM_2210: _getForm2210Prompt,
  FORM_3903: _getForm3903Prompt,
  FORM_4684: _getForm4684Prompt,
  FORM_4868: _getForm4868Prompt,
  FORM_8936: _getForm8936Prompt,
  FORM_W9_ISSUED: _getFormW9Prompt,
  FORM_6251: _getForm6251Prompt,
  FORM_2555: _getForm2555Prompt,
  FORM_5329: _getForm5329Prompt,
  FORM_8379: _getForm8379Prompt,
  FORM_8582: _getForm8582Prompt,
  FORM_8880: _getForm8880Prompt,
  FORM_8962: _getForm8962Prompt,
  FORM_8938: _getForm8938Prompt,
  // Phase 7: Tax Returns
  FORM_1040_SR: _getForm1040SRPrompt,
  FORM_1040_NR: _getForm1040NRPrompt,
  FORM_1040_X: _getForm1040XPrompt,
  STATE_TAX_RETURN: _getStateTaxReturnPrompt,
  // Phase 8: Semi-Structured Documents
  ITIN_LETTER: _getItinLetterPrompt,
  PAY_STUB: _getPayStubPrompt,
  GREEN_CARD: _getGreenCardPrompt,
  STOCK_OPTION_AGREEMENT: _getStockOptionPrompt,
  RSU_STATEMENT: _getRsuPrompt,
  NATURALIZATION_CERTIFICATE: _getNaturalizationPrompt,
  BROKERAGE_STATEMENT: _getBrokeragePrompt,
  PROPERTY_TAX_STATEMENT: _getPropertyTaxPrompt,
  ESPP_STATEMENT: _getEsppPrompt,
  WORK_VISA: _getWorkVisaPrompt,
  MARRIAGE_CERTIFICATE: _getMarriageCertPrompt,
  DIVORCE_DECREE: _getDivorcePrompt,
  POWER_OF_ATTORNEY: _getPowerOfAttorneyPrompt,
  CLOSING_DISCLOSURE: _getClosingDisclosurePrompt,
  HUD_1: _getHud1Prompt,
  PMI_STATEMENT: _getPmiPrompt,
  MORTGAGE_POINTS_STATEMENT: _getMortgagePointsPrompt,
  ESTIMATED_TAX_PAYMENT: _getEstimatedTaxPrompt,
  EXTENSION_PAYMENT_PROOF: _getExtensionProofPrompt,
  PRIOR_YEAR_RETURN: _getPriorYearPrompt,
  CRYPTO_TAX_REPORT: _getCryptoTaxPrompt,
  FOREIGN_BANK_STATEMENT: _getForeignBankPrompt,
  FOREIGN_TAX_STATEMENT: _getForeignTaxPrompt,
  BALANCE_SHEET: _getBalanceSheetPrompt,
  PAYROLL_REPORT: _getPayrollPrompt,
  DEPRECIATION_SCHEDULE: _getDepreciationPrompt,
  PENSION_STATEMENT: _getPensionPrompt,
  IRA_STATEMENT: _getIraPrompt,
  STATEMENT_401K: _get401kPrompt,
  ROTH_IRA_STATEMENT: _getRothIraPrompt,
  RMD_STATEMENT: _getRmdPrompt,
  HSA_STATEMENT: _getHsaPrompt,
  FSA_STATEMENT: _getFsaPrompt,
  DAYCARE_STATEMENT: _getDaycarePrompt,
  DEPENDENT_CARE_FSA: _getDependentCareFsaPrompt,
}

/** Validator functions by document type */
const validators: Record<string, (data: unknown) => boolean> = {
  // Existing
  W2: _validateW2,
  FORM_1099_INT: _validate1099Int,
  FORM_1099_NEC: _validate1099Nec,
  FORM_1099_K: _validate1099K,
  FORM_1099_DIV: _validate1099Div,
  FORM_1099_R: _validate1099R,
  FORM_1099_SSA: _validateSsa1099,
  FORM_1098: _validate1098,
  FORM_1095_A: _validate1095A,
  FORM_1098_T: _validate1098T,
  FORM_1099_G: _validate1099G,
  FORM_1099_MISC: _validate1099Misc,
  SCHEDULE_K1: _validateK1,
  BANK_STATEMENT: _validateBankStatement,
  SSN_CARD: _validateSsnCard,
  DRIVER_LICENSE: _validateDL,
  FORM_1040: _validateForm1040,
  SCHEDULE_1: _validateSchedule1,
  SCHEDULE_C: _validateScheduleC,
  SCHEDULE_SE: _validateScheduleSE,
  SCHEDULE_D: _validateScheduleD,
  SCHEDULE_E: _validateScheduleE,
  // Phase 2: 1099 Variants
  FORM_1099_B: _validate1099B,
  FORM_1099_S: _validate1099S,
  FORM_1099_C: _validate1099C,
  FORM_1099_SA: _validate1099SA,
  FORM_1099_Q: _validate1099Q,
  FORM_1099_A: _validate1099A,
  FORM_1099_OID: _validate1099OID,
  FORM_1099_LTC: _validate1099LTC,
  FORM_1099_PATR: _validate1099PATR,
  FORM_1099_CAP: _validate1099CAP,
  FORM_1099_H: _validate1099H,
  FORM_1099_LS: _validate1099LS,
  FORM_1099_QA: _validate1099QA,
  FORM_1099_SB: _validate1099SB,
  RRB_1099: _validateRRB1099,
  RRB_1099_R: _validateRRB1099R,
  // Phase 3: Schedules
  SCHEDULE_2: _validateSchedule2,
  SCHEDULE_3: _validateSchedule3,
  SCHEDULE_A: _validateScheduleA,
  SCHEDULE_B: _validateScheduleB,
  SCHEDULE_8812: _validateSchedule8812,
  SCHEDULE_EIC: _validateScheduleEIC,
  SCHEDULE_F: _validateScheduleF,
  SCHEDULE_H: _validateScheduleH,
  SCHEDULE_J: _validateScheduleJ,
  SCHEDULE_R: _validateScheduleR,
  // Phase 4: K-1 Variants + Health/Education
  SCHEDULE_K1_1065: _validateK1_1065,
  SCHEDULE_K1_1120S: _validateK1_1120S,
  SCHEDULE_K1_1041: _validateK1_1041,
  FORM_1095_B: _validate1095B,
  FORM_1095_C: _validate1095C,
  FORM_5498_SA: _validate5498SA,
  FORM_1098_E: _validate1098E,
  FORM_8332: _validate8332,
  // Phase 5: IRS Forms Part 1
  FORM_2441: _validateForm2441,
  FORM_4562: _validateForm4562,
  FORM_4797: _validateForm4797,
  FORM_5695: _validateForm5695,
  FORM_8283: _validateForm8283,
  FORM_8606: _validateForm8606,
  FORM_8829: _validateForm8829,
  FORM_8863: _validateForm8863,
  FORM_8889: _validateForm8889,
  FORM_8949: _validateForm8949,
  FORM_8959: _validateForm8959,
  FORM_8960: _validateForm8960,
  FORM_8995: _validateForm8995,
  // Phase 6: IRS Forms Part 2
  FORM_8995_A: _validateForm8995A,
  W2G: _validateW2G,
  FORM_2210: _validateForm2210,
  FORM_3903: _validateForm3903,
  FORM_4684: _validateForm4684,
  FORM_4868: _validateForm4868,
  FORM_8936: _validateForm8936,
  FORM_W9_ISSUED: _validateFormW9,
  FORM_6251: _validateForm6251,
  FORM_2555: _validateForm2555,
  FORM_5329: _validateForm5329,
  FORM_8379: _validateForm8379,
  FORM_8582: _validateForm8582,
  FORM_8880: _validateForm8880,
  FORM_8962: _validateForm8962,
  FORM_8938: _validateForm8938,
  // Phase 7: Tax Returns
  FORM_1040_SR: _validateForm1040SR,
  FORM_1040_NR: _validateForm1040NR,
  FORM_1040_X: _validateForm1040X,
  STATE_TAX_RETURN: _validateStateTaxReturn,
  // Phase 8: Semi-Structured Documents
  ITIN_LETTER: _validateItinLetter,
  PAY_STUB: _validatePayStub,
  GREEN_CARD: _validateGreenCard,
  STOCK_OPTION_AGREEMENT: _validateStockOption,
  RSU_STATEMENT: _validateRsu,
  NATURALIZATION_CERTIFICATE: _validateNaturalization,
  BROKERAGE_STATEMENT: _validateBrokerage,
  PROPERTY_TAX_STATEMENT: _validatePropertyTax,
  ESPP_STATEMENT: _validateEspp,
  WORK_VISA: _validateWorkVisa,
  MARRIAGE_CERTIFICATE: _validateMarriageCert,
  DIVORCE_DECREE: _validateDivorce,
  POWER_OF_ATTORNEY: _validatePowerOfAttorney,
  CLOSING_DISCLOSURE: _validateClosingDisclosure,
  HUD_1: _validateHud1,
  PMI_STATEMENT: _validatePmi,
  MORTGAGE_POINTS_STATEMENT: _validateMortgagePoints,
  ESTIMATED_TAX_PAYMENT: _validateEstimatedTax,
  EXTENSION_PAYMENT_PROOF: _validateExtensionProof,
  PRIOR_YEAR_RETURN: _validatePriorYear,
  CRYPTO_TAX_REPORT: _validateCryptoTax,
  FOREIGN_BANK_STATEMENT: _validateForeignBank,
  FOREIGN_TAX_STATEMENT: _validateForeignTax,
  BALANCE_SHEET: _validateBalanceSheet,
  PAYROLL_REPORT: _validatePayroll,
  DEPRECIATION_SCHEDULE: _validateDepreciation,
  PENSION_STATEMENT: _validatePension,
  IRA_STATEMENT: _validateIra,
  STATEMENT_401K: _validate401k,
  ROTH_IRA_STATEMENT: _validateRothIra,
  RMD_STATEMENT: _validateRmd,
  HSA_STATEMENT: _validateHsa,
  FSA_STATEMENT: _validateFsa,
  DAYCARE_STATEMENT: _validateDaycare,
  DEPENDENT_CARE_FSA: _validateDependentCareFsa,
}

/** Field label maps by document type */
const labelMaps: Record<string, Record<string, string>> = {
  // Existing
  W2: _W2Labels,
  FORM_1099_INT: _1099IntLabels,
  FORM_1099_NEC: _1099NecLabels,
  FORM_1099_K: _1099KLabels,
  FORM_1099_DIV: _1099DivLabels,
  FORM_1099_R: _1099RLabels,
  FORM_1099_SSA: _Ssa1099Labels,
  FORM_1098: _1098Labels,
  FORM_1095_A: _1095ALabels,
  FORM_1098_T: _1098TLabels,
  FORM_1099_G: _1099GLabels,
  FORM_1099_MISC: _1099MiscLabels,
  SCHEDULE_K1: _K1Labels,
  BANK_STATEMENT: _BankStatementLabels,
  SSN_CARD: _SsnCardLabels,
  DRIVER_LICENSE: _DLLabels,
  FORM_1040: _Form1040Labels,
  SCHEDULE_1: _Schedule1Labels,
  SCHEDULE_C: _ScheduleCLabels,
  SCHEDULE_SE: _ScheduleSELabels,
  SCHEDULE_D: _ScheduleDLabels,
  SCHEDULE_E: _ScheduleELabels,
  // Phase 2: 1099 Variants
  FORM_1099_B: _1099BLabels,
  FORM_1099_S: _1099SLabels,
  FORM_1099_C: _1099CLabels,
  FORM_1099_SA: _1099SALabels,
  FORM_1099_Q: _1099QLabels,
  FORM_1099_A: _1099ALabels,
  FORM_1099_OID: _1099OIDLabels,
  FORM_1099_LTC: _1099LTCLabels,
  FORM_1099_PATR: _1099PATRLabels,
  FORM_1099_CAP: _1099CAPLabels,
  FORM_1099_H: _1099HLabels,
  FORM_1099_LS: _1099LSLabels,
  FORM_1099_QA: _1099QALabels,
  FORM_1099_SB: _1099SBLabels,
  RRB_1099: _RRB1099Labels,
  RRB_1099_R: _RRB1099RLabels,
  // Phase 3: Schedules
  SCHEDULE_2: _Schedule2Labels,
  SCHEDULE_3: _Schedule3Labels,
  SCHEDULE_A: _ScheduleALabels,
  SCHEDULE_B: _ScheduleBLabels,
  SCHEDULE_8812: _Schedule8812Labels,
  SCHEDULE_EIC: _ScheduleEICLabels,
  SCHEDULE_F: _ScheduleFLabels,
  SCHEDULE_H: _ScheduleHLabels,
  SCHEDULE_J: _ScheduleJLabels,
  SCHEDULE_R: _ScheduleRLabels,
  // Phase 4: K-1 Variants + Health/Education
  SCHEDULE_K1_1065: _K1_1065Labels,
  SCHEDULE_K1_1120S: _K1_1120SLabels,
  SCHEDULE_K1_1041: _K1_1041Labels,
  FORM_1095_B: _1095BLabels,
  FORM_1095_C: _1095CLabels,
  FORM_5498_SA: _5498SALabels,
  FORM_1098_E: _1098ELabels,
  FORM_8332: _8332Labels,
  // Phase 5: IRS Forms Part 1
  FORM_2441: _Form2441Labels,
  FORM_4562: _Form4562Labels,
  FORM_4797: _Form4797Labels,
  FORM_5695: _Form5695Labels,
  FORM_8283: _Form8283Labels,
  FORM_8606: _Form8606Labels,
  FORM_8829: _Form8829Labels,
  FORM_8863: _Form8863Labels,
  FORM_8889: _Form8889Labels,
  FORM_8949: _Form8949Labels,
  FORM_8959: _Form8959Labels,
  FORM_8960: _Form8960Labels,
  FORM_8995: _Form8995Labels,
  // Phase 6: IRS Forms Part 2
  FORM_8995_A: _Form8995ALabels,
  W2G: _W2GLabels,
  FORM_2210: _Form2210Labels,
  FORM_3903: _Form3903Labels,
  FORM_4684: _Form4684Labels,
  FORM_4868: _Form4868Labels,
  FORM_8936: _Form8936Labels,
  FORM_W9_ISSUED: _FormW9Labels,
  FORM_6251: _Form6251Labels,
  FORM_2555: _Form2555Labels,
  FORM_5329: _Form5329Labels,
  FORM_8379: _Form8379Labels,
  FORM_8582: _Form8582Labels,
  FORM_8880: _Form8880Labels,
  FORM_8962: _Form8962Labels,
  FORM_8938: _Form8938Labels,
  // Phase 7: Tax Returns
  FORM_1040_SR: _Form1040SRLabels,
  FORM_1040_NR: _Form1040NRLabels,
  FORM_1040_X: _Form1040XLabels,
  STATE_TAX_RETURN: _StateTaxReturnLabels,
  // Phase 8: Semi-Structured Documents
  ITIN_LETTER: _ItinLetterLabels,
  PAY_STUB: _PayStubLabels,
  GREEN_CARD: _GreenCardLabels,
  STOCK_OPTION_AGREEMENT: _StockOptionLabels,
  RSU_STATEMENT: _RsuLabels,
  NATURALIZATION_CERTIFICATE: _NaturalizationLabels,
  BROKERAGE_STATEMENT: _BrokerageLabels,
  PROPERTY_TAX_STATEMENT: _PropertyTaxLabels,
  ESPP_STATEMENT: _EsppLabels,
  WORK_VISA: _WorkVisaLabels,
  MARRIAGE_CERTIFICATE: _MarriageCertLabels,
  DIVORCE_DECREE: _DivorceLabels,
  POWER_OF_ATTORNEY: _PowerOfAttorneyLabels,
  CLOSING_DISCLOSURE: _ClosingDisclosureLabels,
  HUD_1: _Hud1Labels,
  PMI_STATEMENT: _PmiLabels,
  MORTGAGE_POINTS_STATEMENT: _MortgagePointsLabels,
  ESTIMATED_TAX_PAYMENT: _EstimatedTaxLabels,
  EXTENSION_PAYMENT_PROOF: _ExtensionProofLabels,
  PRIOR_YEAR_RETURN: _PriorYearLabels,
  CRYPTO_TAX_REPORT: _CryptoTaxLabels,
  FOREIGN_BANK_STATEMENT: _ForeignBankLabels,
  FOREIGN_TAX_STATEMENT: _ForeignTaxLabels,
  BALANCE_SHEET: _BalanceSheetLabels,
  PAYROLL_REPORT: _PayrollLabels,
  DEPRECIATION_SCHEDULE: _DepreciationLabels,
  PENSION_STATEMENT: _PensionLabels,
  IRA_STATEMENT: _IraLabels,
  STATEMENT_401K: _401kLabels,
  ROTH_IRA_STATEMENT: _RothIraLabels,
  RMD_STATEMENT: _RmdLabels,
  HSA_STATEMENT: _HsaLabels,
  FSA_STATEMENT: _FsaLabels,
  DAYCARE_STATEMENT: _DaycareLabels,
  DEPENDENT_CARE_FSA: _DependentCareFsaLabels,
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get the appropriate OCR prompt for a document type
 * Falls back to generic extractor for unknown types
 */
export function getOcrPromptForDocType(docType: string): string | null {
  const getter = promptGetters[docType]
  if (getter) return getter()
  // Generic fallback for any document type not in the map
  return _getGenericPrompt(docType)
}

/**
 * Check if a document type supports OCR extraction
 * With generic fallback, all types are supported
 */
export function supportsOcrExtraction(_docType: string): boolean {
  return true
}

/**
 * Validate extracted data based on document type
 * Falls back to generic validator for unknown types
 */
export function validateExtractedData(docType: string, data: unknown): boolean {
  const validator = validators[docType]
  if (validator) return validator(data)
  return _validateGeneric(data)
}

/**
 * Get field labels for a document type
 * Falls back to generic labels for unknown types
 */
export function getFieldLabels(docType: string): Record<string, string> {
  return labelMaps[docType] || _GenericLabels
}
