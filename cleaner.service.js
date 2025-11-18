/**
 * Vietnamese OCR Text Cleaner - Expanded Version
 * 
 * Supports 14+ document types with 250+ legal/business vocabulary patterns
 * Optimized for Tesseract vie+eng LSTM output at 300 DPI
 * 
 * @author Tiến Phước Group Technology Team
 * @version 2.0.0
 */

export class VietnameseOCRCleaner {
  constructor(options = {}) {
    this.options = {
      aggressiveCleaning: false,
      preserveCodes: true,
      fixStructure: true,
      detectDocumentType: true,
      ...options
    };

    // ============================================
    // DOCUMENT TYPE SIGNATURES
    // ============================================
    this.documentTypeSignatures = {
      // CONTRACTS & AGREEMENTS
      contract_lease: [
        /HỢP ĐỒNG CHO THUÊ/i,
        /BÊN CHO THUÊ.*BÊN THUÊ/is,
        /thời hạn thuê/i,
        /tiền đặt cọc/i
      ],
      contract_employment: [
        /HỢP ĐỒNG LAO ĐỘNG/i,
        /người lao động/i,
        /người sử dụng lao động/i,
        /thời gian thử việc/i,
        /mức lương/i
      ],
      contract_service: [
        /HỢP ĐỒNG DỊCH VỤ/i,
        /BÊN CUNG CẤP DỊCH VỤ/i,
        /BÊN SỬ DỤNG DỊCH VỤ/i,
        /phạm vi dịch vụ/i
      ],
      contract_sale: [
        /HỢP ĐỒNG MUA BÁN/i,
        /BÊN BÁN.*BÊN MUA/is,
        /hàng hóa/i,
        /bảo hành/i
      ],

      // FINANCIAL DOCUMENTS
      invoice: [
        /HÓA ĐƠN/i,
        /VAT/i,
        /Mã số thuế/i,
        /Đơn giá.*Thành tiền/is,
        /Tổng tiền/i
      ],
      receipt: [
        /BIÊN LAI/i,
        /PHIẾU THU/i,
        /đã nhận của/i,
        /tổng số tiền/i
      ],
      payment_request: [
        /PHIẾU ĐỀ NGHỊ THANH TOÁN/i,
        /đề nghị thanh toán/i,
        /người đề nghị/i,
        /bộ phận đề nghị/i
      ],
      purchase_order: [
        /ĐƠN ĐẶT HÀNG/i,
        /ĐƠN HÀNG/i,
        /số lượng.*đơn giá/is,
        /ngày giao hàng/i
      ],

      // ADMINISTRATIVE DOCUMENTS
      delivery_note: [
        /PHIẾU GIAO HÀNG/i,
        /PHIẾU XUẤT KHO/i,
        /người giao hàng/i,
        /người nhận hàng/i
      ],
      meeting_minutes: [
        /BIÊN BẢN HỌP/i,
        /BIÊN BẢN CUỘC HỌP/i,
        /thành phần tham dự/i,
        /nội dung cuộc họp/i,
        /kết luận/i
      ],
      memo: [
        /CÔNG VĂN/i,
        /THÔNG BÁO/i,
        /Kính gửi/i,
        /V\/v:/i,
        /Trân trọng/i
      ],
      report: [
        /BÁO CÁO/i,
        /kết quả.*đạt được/is,
        /tình hình.*thực hiện/is,
        /đề xuất.*kiến nghị/is
      ],

      // LEGAL & ADMINISTRATIVE
      certificate: [
        /GIẤY CHỨNG NHẬN/i,
        /CHỨNG NHẬN/i,
        /cấp cho/i,
        /có giá trị/i
      ],
      power_of_attorney: [
        /GIẤY ỦY QUYỀN/i,
        /ỦY QUYỀN/i,
        /người ủy quyền/i,
        /người được ủy quyền/i,
        /phạm vi ủy quyền/i
      ],
      proposal: [
        /ĐỀ XUẤT/i,
        /TỜ TRÌNH/i,
        /lý do đề xuất/i,
        /phương án/i,
        /kinh phí/i
      ]
    };

    // ============================================
    // MECHANICAL OCR ARTIFACTS
    // ============================================
    this.mechanicalArtifacts = [
      /^¬\d+\s*/gm,
      /\sir\s*_¬\s*ee\s*-\s*/g,
      /\s+_+\s+/g,
      /[„""]/g,
      /[⁄／]/g,
      /\s*[:.]\s*$/gm,
      /^\s*[:.]\s*/gm,
      /\.{3,}/g,
      /,{2,}/g,
      /\s{2,}/g,
      /\n{4,}/g,
      /[\u00AD­]/g,
      /[\u200B-\u200D\uFEFF]/g,
      /\u00A0/g,
    ];

    // ============================================
    // VIETNAMESE CHARACTER FIXES
    // ============================================
    this.vietnameseCharFixes = [
      // Đ/đ confusion
      { pattern: /\bDia\s+chi\b/gi, replacement: 'Địa chỉ' },
      { pattern: /\bDien\s+thoai\b/gi, replacement: 'Điện thoại' },
      { pattern: /\bdai\s+dien\b/gi, replacement: 'đại diện' },
      { pattern: /\bDai\s+dien\b/gi, replacement: 'Đại diện' },
      { pattern: /\bDon\s+gia\b/gi, replacement: 'Đơn giá' },
      { pattern: /\bđon\s+vi\b/gi, replacement: 'đơn vị' },
      { pattern: /\bđang\s+ky\b/gi, replacement: 'đăng ký' },
      { pattern: /\bđieu\b/gi, replacement: 'điều' },
      { pattern: /\bDIEU\b/g, replacement: 'ĐIỀU' },
      { pattern: /\bđên\b/gi, replacement: 'đến' },
      
      // Ô/ô confusion
      { pattern: /\bHop\s+dong\b/gi, replacement: 'Hợp đồng' },
      { pattern: /\bHOP\s+DONG\b/g, replacement: 'HỢP ĐỒNG' },
      { pattern: /\btoa\s+nha\b/gi, replacement: 'toà nhà' },
      { pattern: /\bToa\s+an\b/gi, replacement: 'Toà án' },
      { pattern: /\bbo\s+phan\b/gi, replacement: 'bộ phận' },
      
      // Ư/ư confusion
      { pattern: /\btru\s+so\b/gi, replacement: 'trụ sở' },
      { pattern: /\bdu\s+an\b/gi, replacement: 'dự án' },
      { pattern: /\bthu\s+tuc\b/gi, replacement: 'thủ tục' },
      
      // Ă/ă confusion
      { pattern: /\bBat\s+dong\s+san\b/gi, replacement: 'Bất động sản' },
      { pattern: /\bBAT\s+DONG\s+SAN\b/g, replacement: 'BẤT ĐỘNG SẢN' },
      { pattern: /\bnang\s+cap\b/gi, replacement: 'nâng cấp' },
      { pattern: /\bthang\s+may\b/gi, replacement: 'thang máy' },
      
      // Â/â confusion  
      { pattern: /\bCan\s+cu\b/gi, replacement: 'Căn cứ' },
      { pattern: /\bCAN\s+CU\b/g, replacement: 'CĂN CỨ' },
      { pattern: /\bcam\s+doan\b/gi, replacement: 'cam đoan' },
      { pattern: /\bthao\s+thuan\b/gi, replacement: 'thoả thuận' },
      
      // Ê/ê confusion
      { pattern: /\bBen\s+A\b/g, replacement: 'Bên A' },
      { pattern: /\bBen\s+B\b/g, replacement: 'Bên B' },
      { pattern: /\bBEN\b/g, replacement: 'BÊN' },
      { pattern: /\bthiet\s+hai\b/gi, replacement: 'thiệt hại' },
      { pattern: /\bkiem\s+tra\b/gi, replacement: 'kiểm tra' },
      { pattern: /\bhieu\s+luc\b/gi, replacement: 'hiệu lực' },
      
      // Common administrative terms
      { pattern: /\bNgay\s+cap\b/gi, replacement: 'Ngày cấp' },
      { pattern: /\bSo\s*:/gi, replacement: 'Số:' },
      { pattern: /\bNgay\s*:/gi, replacement: 'Ngày:' },
      { pattern: /\bQuan\s+(\d+)\b/g, replacement: 'Quận $1' },
      { pattern: /\bPhuong\s+(\d+)\b/g, replacement: 'Phường $1' },
      { pattern: /\bTP\.\s*HCM\b/gi, replacement: 'TP.HCM' },
      { pattern: /\bTPHCM\b/gi, replacement: 'TP.HCM' },
    ];

    // ============================================
    // CORE BUSINESS VOCABULARY
    // ============================================
    this.coreVocabulary = [
      // Company/Organization
      { pattern: /\bCong\s+ty\b/gi, replacement: 'Công ty' },
      { pattern: /\bCo\s+phan\b/gi, replacement: 'Cổ phần' },
      { pattern: /\bTNHH\b/g, replacement: 'TNHH' },
      { pattern: /\bGiam\s+doc\b/gi, replacement: 'Giám đốc' },
      { pattern: /\bTong\s+giam\s+doc\b/gi, replacement: 'Tổng giám đốc' },
      { pattern: /\bHoi\s+dong\b/gi, replacement: 'Hội đồng' },
      { pattern: /\bquan\s+tri\b/gi, replacement: 'quản trị' },
      { pattern: /\bGiay\s+chung\s+nhan\b/gi, replacement: 'Giấy chứng nhận' },
      { pattern: /\bMa\s+so\s+thue\b/gi, replacement: 'Mã số thuế' },
      
      // Legal/Contract terms
      { pattern: /\bnghia\s+vu\b/gi, replacement: 'nghĩa vụ' },
      { pattern: /\bquyen\s+loi\b/gi, replacement: 'quyền lợi' },
      { pattern: /\btranh\s+chap\b/gi, replacement: 'tranh chấp' },
      { pattern: /\bboi\s+thuong\b/gi, replacement: 'bồi thường' },
      { pattern: /\bphat\s+sinh\b/gi, replacement: 'phát sinh' },
      { pattern: /\bthuc\s+hien\b/gi, replacement: 'thực hiện' },
      
      // Financial terms
      { pattern: /\bthanh\s+toan\b/gi, replacement: 'thanh toán' },
      { pattern: /\bdat\s+coc\b/gi, replacement: 'đặt cọc' },
      { pattern: /\bTong\s+cong\b/gi, replacement: 'Tổng cộng' },
      { pattern: /\bBang\s+chu\b/gi, replacement: 'Bằng chữ' },
      { pattern: /\bchi\s+phi\b/gi, replacement: 'chi phí' },
      
      // Time/Date
      { pattern: /\bThoi\s+han\b/gi, replacement: 'Thời hạn' },
      { pattern: /\bthoi\s+gian\b/gi, replacement: 'thời gian' },
      { pattern: /\bban\s+giao\b/gi, replacement: 'bàn giao' },
      { pattern: /\bgia\s+han\b/gi, replacement: 'gia hạn' },
      
      // Common verbs
      { pattern: /\bsu\s+dung\b/gi, replacement: 'sử dụng' },
      { pattern: /\bquan\s+ly\b/gi, replacement: 'quản lý' },
      { pattern: /\bbao\s+ve\b/gi, replacement: 'bảo vệ' },
      { pattern: /\bve\s+sinh\b/gi, replacement: 'vệ sinh' },
      { pattern: /\ban\s+ninh\b/gi, replacement: 'an ninh' },
      { pattern: /\btrat\s+tu\b/gi, replacement: 'trật tự' },
      
      // Number words
      { pattern: /\btrieu\b/gi, replacement: 'triệu' },
      { pattern: /\bnghin\b/gi, replacement: 'nghìn' },
      { pattern: /\btram\b/gi, replacement: 'trăm' },
      { pattern: /\bmuoi\b/gi, replacement: 'mươi' },
      { pattern: /\blam\b(?=\s+(nghin|nghìn|tram|trăm|muoi|mươi))/gi, replacement: 'lăm' },
    ];

    // ============================================
    // EXPANDED LEGAL VOCABULARY
    // ============================================
    this.legalVocabulary = {
      // Legal references
      general_legal: [
        { pattern: /\bBo\s+luat\s+Dan\s+su\b/gi, replacement: 'Bộ luật Dân sự' },
        { pattern: /\bBo\s+luat\s+Lao\s+dong\b/gi, replacement: 'Bộ luật Lao động' },
        { pattern: /\bLuat\s+Doanh\s+nghiep\b/gi, replacement: 'Luật Doanh nghiệp' },
        { pattern: /\bLuat\s+Kinh\s+Doanh\s+Bat\s+Dong\s+San\b/gi, replacement: 'Luật Kinh Doanh Bất Động Sản' },
        { pattern: /\bLuat\s+Thuong\s+mai\b/gi, replacement: 'Luật Thương mại' },
        { pattern: /\bNghi\s+dinh\b/gi, replacement: 'Nghị định' },
        { pattern: /\bThong\s+tu\b/gi, replacement: 'Thông tư' },
        { pattern: /\bQuyet\s+dinh\b/gi, replacement: 'Quyết định' },
        { pattern: /\bQH\d+\b/g, replacement: match => match.toUpperCase() },
      ],

      // Contract terms
      contract_terms: [
        { pattern: /\btrach\s+nhiem\b/gi, replacement: 'trách nhiệm' },
        { pattern: /\bvi\s+pham\b/gi, replacement: 'vi phạm' },
        { pattern: /\btoan\s+bo\b/gi, replacement: 'toàn bộ' },
        { pattern: /\bđon\s+phuong\b/gi, replacement: 'đơn phương' },
        { pattern: /\bcham\s+dut\b/gi, replacement: 'chấm dứt' },
        { pattern: /\bhuy\s+bo\b/gi, replacement: 'hủy bỏ' },
        { pattern: /\bco\s+hieu\s+luc\b/gi, replacement: 'có hiệu lực' },
        { pattern: /\bhet\s+hieu\s+luc\b/gi, replacement: 'hết hiệu lực' },
        { pattern: /\btrong\s+truong\s+hop\b/gi, replacement: 'trong trường hợp' },
        { pattern: /\bkhong\s+duoc\b/gi, replacement: 'không được' },
        { pattern: /\bduoc\s+quyen\b/gi, replacement: 'được quyền' },
      ],

      // Corporate terms
      corporate_terms: [
        { pattern: /\bHoi\s+dong\s+quan\s+tri\b/gi, replacement: 'Hội đồng quản trị' },
        { pattern: /\bBan\s+giam\s+doc\b/gi, replacement: 'Ban giám đốc' },
        { pattern: /\bPho\s+giam\s+doc\b/gi, replacement: 'Phó giám đốc' },
        { pattern: /\bKe\s+toan\s+truong\b/gi, replacement: 'Kế toán trưởng' },
        { pattern: /\bNguoi\s+dai\s+dien\s+phap\s+luat\b/gi, replacement: 'Người đại diện pháp luật' },
        { pattern: /\bVon\s+dieu\s+le\b/gi, replacement: 'Vốn điều lệ' },
        { pattern: /\bGiay\s+chung\s+nhan\s+dang\s+ky\s+kinh\s+doanh\b/gi, replacement: 'Giấy chứng nhận đăng ký kinh doanh' },
      ],

      // Financial terms
      financial_terms: [
        { pattern: /\btam\s+ung\b/gi, replacement: 'tạm ứng' },
        { pattern: /\bung\s+truoc\b/gi, replacement: 'ứng trước' },
        { pattern: /\bhoan\s+tra\b/gi, replacement: 'hoàn trả' },
        { pattern: /\bkhau\s+tru\b/gi, replacement: 'khấu trừ' },
        { pattern: /\bquyet\s+toan\b/gi, replacement: 'quyết toán' },
        { pattern: /\blai\s+suat\b/gi, replacement: 'lãi suất' },
        { pattern: /\bthue\s+GTGT\b/gi, replacement: 'thuế GTGT' },
        { pattern: /\bthue\s+VAT\b/gi, replacement: 'thuế VAT' },
        { pattern: /\bhoa\s+don\b/gi, replacement: 'hóa đơn' },
        { pattern: /\bchung\s+tu\b/gi, replacement: 'chứng từ' },
        { pattern: /\bphieu\s+chi\b/gi, replacement: 'phiếu chi' },
        { pattern: /\bphieu\s+thu\b/gi, replacement: 'phiếu thu' },
        { pattern: /\bbien\s+lai\b/gi, replacement: 'biên lai' },
      ],

      // Real estate terms
      real_estate_terms: [
        { pattern: /\bcho\s+thue\b/gi, replacement: 'cho thuê' },
        { pattern: /\bmua\s+ban\b/gi, replacement: 'mua bán' },
        { pattern: /\bchuyen\s+nhuong\b/gi, replacement: 'chuyển nhượng' },
        { pattern: /\bdat\s+dai\b/gi, replacement: 'đất đai' },
        { pattern: /\bvan\s+phong\b/gi, replacement: 'văn phòng' },
        { pattern: /\bmat\s+bang\b/gi, replacement: 'mặt bằng' },
        { pattern: /\bdien\s+tich\b/gi, replacement: 'diện tích' },
        { pattern: /\bcan\s+ho\b/gi, replacement: 'căn hộ' },
        { pattern: /\bquyen\s+su\s+dung\s+dat\b/gi, replacement: 'quyền sử dụng đất' },
        { pattern: /\bphi\s+quan\s+ly\b/gi, replacement: 'phí quản lý' },
        { pattern: /\bphi\s+bao\s+tri\b/gi, replacement: 'phí bảo trì' },
        { pattern: /\bphi\s+dich\s+vu\b/gi, replacement: 'phí dịch vụ' },
      ],

      // Employment terms
      employment_terms: [
        { pattern: /\bhop\s+dong\s+lao\s+dong\b/gi, replacement: 'hợp đồng lao động' },
        { pattern: /\bnguoi\s+lao\s+dong\b/gi, replacement: 'người lao động' },
        { pattern: /\bnhan\s+vien\b/gi, replacement: 'nhân viên' },
        { pattern: /\bluong\b/gi, replacement: 'lương' },
        { pattern: /\bmuc\s+luong\b/gi, replacement: 'mức lương' },
        { pattern: /\bphu\s+cap\b/gi, replacement: 'phụ cấp' },
        { pattern: /\bthuong\b/gi, replacement: 'thưởng' },
        { pattern: /\bnghi\s+phep\b/gi, replacement: 'nghỉ phép' },
        { pattern: /\bthu\s+viec\b/gi, replacement: 'thử việc' },
        { pattern: /\bbao\s+hiem\s+xa\s+hoi\b/gi, replacement: 'bảo hiểm xã hội' },
        { pattern: /\bBHXH\b/g, replacement: 'BHXH' },
        { pattern: /\bbao\s+hiem\s+y\s+te\b/gi, replacement: 'bảo hiểm y tế' },
        { pattern: /\bBHYT\b/g, replacement: 'BHYT' },
      ],

      // Healthcare terms (for hospital business)
      healthcare_terms: [
        { pattern: /\bbenh\s+vien\b/gi, replacement: 'bệnh viện' },
        { pattern: /\bphong\s+kham\b/gi, replacement: 'phòng khám' },
        { pattern: /\bbac\s+si\b/gi, replacement: 'bác sĩ' },
        { pattern: /\by\s+ta\b/gi, replacement: 'y tá' },
        { pattern: /\bdieu\s+duong\b/gi, replacement: 'điều dưỡng' },
        { pattern: /\bbenh\s+nhan\b/gi, replacement: 'bệnh nhân' },
        { pattern: /\bkham\s+benh\b/gi, replacement: 'khám bệnh' },
        { pattern: /\bdieu\s+tri\b/gi, replacement: 'điều trị' },
        { pattern: /\bxet\s+nghiem\b/gi, replacement: 'xét nghiệm' },
        { pattern: /\bthiet\s+bi\s+y\s+te\b/gi, replacement: 'thiết bị y tế' },
      ],

      // Agriculture terms (for farm business)
      agriculture_terms: [
        { pattern: /\bnong\s+nghiep\b/gi, replacement: 'nông nghiệp' },
        { pattern: /\bnong\s+trai\b/gi, replacement: 'nông trại' },
        { pattern: /\bnong\s+san\b/gi, replacement: 'nông sản' },
        { pattern: /\bthuc\s+pham\b/gi, replacement: 'thực phẩm' },
        { pattern: /\ban\s+toan\s+thuc\s+pham\b/gi, replacement: 'an toàn thực phẩm' },
        { pattern: /\bphan\s+bon\b/gi, replacement: 'phân bón' },
        { pattern: /\bbao\s+quan\b/gi, replacement: 'bảo quản' },
        { pattern: /\bche\s+bien\b/gi, replacement: 'chế biến' },
        { pattern: /\bquy\s+trinh\s+san\s+xuat\b/gi, replacement: 'quy trình sản xuất' },
      ],

      // Administrative terms
      administrative_terms: [
        { pattern: /\bthu\s+tuc\s+hanh\s+chinh\b/gi, replacement: 'thủ tục hành chính' },
        { pattern: /\bgiay\s+to\b/gi, replacement: 'giấy tờ' },
        { pattern: /\bho\s+so\b/gi, replacement: 'hồ sơ' },
        { pattern: /\bcan\s+cuoc\s+cong\s+dan\b/gi, replacement: 'căn cước công dân' },
        { pattern: /\bCCCD\b/g, replacement: 'CCCD' },
        { pattern: /\bcong\s+chung\b/gi, replacement: 'công chứng' },
        { pattern: /\bgiay\s+phep\s+kinh\s+doanh\b/gi, replacement: 'giấy phép kinh doanh' },
      ],

      // Government terms
      government_terms: [
        { pattern: /\bNha\s+nuoc\b/gi, replacement: 'Nhà nước' },
        { pattern: /\bChinh\s+phu\b/gi, replacement: 'Chính phủ' },
        { pattern: /\bUBND\b/g, replacement: 'UBND' },
        { pattern: /\bUy\s+ban\s+nhan\s+dan\b/gi, replacement: 'Ủy ban nhân dân' },
        { pattern: /\bToa\s+an\b/gi, replacement: 'Toà án' },
        { pattern: /\bCong\s+an\b/gi, replacement: 'Công an' },
      ]
    };

    // ============================================
    // PRESERVE PATTERNS
    // ============================================
    this.preservePatterns = [
      /\b\d{2,3}_[A-Z]{2,10}\b/g,
      /\b[A-Z]_[A-Z]{2}_[A-Z]\d{2}_\d{2}\b/g,
      /\b\d{2}\.\d{2}\.\d{2}\.\d{2}\b/g,
      /\b\d{6,}\/[A-Z0-9-]+\b/gi,
      /\b[A-Z]{2,}\d+\b/g,
      /\b\d{10,13}\b/g,
      /\b0\d{9,10}\b/g,
    ];

    // ============================================
    // DOCUMENT FORMATTING
    // ============================================
    this.documentFormatting = {
      contract: {
        articlePattern: /\b(?:DIEU|Dieu)\s*(\d+)\b/gi,
        articleReplacement: 'ĐIỀU $1',
        sectionPatterns: [
          { pattern: /\bI\.\s*BEN\s+CHO\s+THUE\b/gi, replacement: 'I. BÊN CHO THUÊ' },
          { pattern: /\bII\.\s*BEN\s+THUE\b/gi, replacement: 'II. BÊN THUÊ' },
          { pattern: /\bPHU\s+LUC\b/gi, replacement: 'PHỤ LỤC' },
        ]
      },
      invoice: {
        headers: [
          { pattern: /\bHOA\s+DON\b/gi, replacement: 'HÓA ĐƠN' },
          { pattern: /\bHOA\s+DON\s+GTGT\b/gi, replacement: 'HÓA ĐƠN GTGT' },
        ]
      }
    };
  }

  /**
   * Main cleaning pipeline
   */
  clean(text) {
    if (!text || typeof text !== 'string') {
      return { 
        cleaned: '', 
        metadata: this._createMetadata(0, 0, 0, 'unknown')
      };
    }

    const originalLength = text.length;
    let cleaned = text;
    const changes = [];

    // Step 1: Detect document type
    const docType = this.options.detectDocumentType 
      ? this._detectDocumentType(cleaned)
      : 'unknown';

    // Step 2: Preserve tokens
    const preservedTokens = this._preserveTokens(cleaned);
    cleaned = preservedTokens.text;

    // Step 3: Remove mechanical artifacts
    const artifactsResult = this._removeMechanicalArtifacts(cleaned);
    cleaned = artifactsResult.text;
    changes.push(...artifactsResult.changes);

    // Step 4: Normalize whitespace
    const normalizedResult = this._normalizeWhitespace(cleaned);
    cleaned = normalizedResult.text;
    changes.push(...normalizedResult.changes);

    // Step 5: Fix Vietnamese characters
    const charFixResult = this._fixVietnameseCharacters(cleaned);
    cleaned = charFixResult.text;
    changes.push(...charFixResult.changes);

    // Step 6: Fix core vocabulary
    const vocabResult = this._fixCoreVocabulary(cleaned);
    cleaned = vocabResult.text;
    changes.push(...vocabResult.changes);

    // Step 7: Apply legal vocabulary
    const legalResult = this._applyLegalVocabulary(cleaned);
    cleaned = legalResult.text;
    changes.push(...legalResult.changes);

    // Step 8: Fix numbers and dates
    const numbersResult = this._fixNumbersAndDates(cleaned);
    cleaned = numbersResult.text;
    changes.push(...numbersResult.changes);

    // Step 9: Document formatting
    if (this.options.fixStructure) {
      const formattingResult = this._applyDocumentFormatting(cleaned, docType);
      cleaned = formattingResult.text;
      changes.push(...formattingResult.changes);
    }

    // Step 10: Restore tokens
    cleaned = this._restoreTokens(cleaned, preservedTokens.tokens);

    // Step 11: Final cleanup
    cleaned = this._finalCleanup(cleaned);

    const metadata = this._createMetadata(
      originalLength,
      cleaned.length,
      changes.length,
      docType
    );
    metadata.changes = changes;
    metadata.confidence = this._calculateConfidence(text, cleaned, changes, docType);

    return { cleaned, metadata };
  }

  // ============================================
  // INTERNAL METHODS
  // ============================================

  _detectDocumentType(text) {
    let maxScore = 0;
    let detectedType = 'unknown';

    for (const [type, patterns] of Object.entries(this.documentTypeSignatures)) {
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.test(text)) score++;
      }
      
      if (score > maxScore) {
        maxScore = score;
        detectedType = type;
      }
    }

    return maxScore >= 2 ? detectedType : 'unknown';
  }

  _preserveTokens(text) {
    const tokens = new Map();
    let tokenIndex = 0;
    let result = text;

    this.preservePatterns.forEach(pattern => {
      result = result.replace(pattern, (match) => {
        const placeholder = `__TOKEN_${tokenIndex}__`;
        tokens.set(placeholder, match);
        tokenIndex++;
        return placeholder;
      });
    });

    return { text: result, tokens };
  }

  _restoreTokens(text, tokens) {
    let result = text;
    tokens.forEach((value, key) => {
      result = result.replace(key, value);
    });
    return result;
  }

  _removeMechanicalArtifacts(text) {
    let result = text;
    const changes = [];

    this.mechanicalArtifacts.forEach(pattern => {
      const before = result;
      result = result.replace(pattern, pattern.source.includes('^') ? '' : ' ');
      if (before !== result) {
        changes.push({ type: 'mechanical_artifact_removal' });
      }
    });

    result = result.replace(/\s+[¬_⁄¦│]{1,2}\s+/g, ' ');
    return { text: result, changes };
  }

  _normalizeWhitespace(text) {
    const changes = [];
    const before = text;

    let result = text
      .replace(/\t/g, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{4,}/g, '\n\n\n')
      .replace(/^ +/gm, '')
      .replace(/ +$/gm, '');

    if (before !== result) {
      changes.push({ type: 'whitespace_normalization' });
    }

    return { text: result.trim(), changes };
  }

  _fixVietnameseCharacters(text) {
    let result = text;
    const changes = [];
    let fixCount = 0;

    this.vietnameseCharFixes.forEach(({ pattern, replacement }) => {
      const matches = result.match(pattern);
      if (matches) {
        result = result.replace(pattern, replacement);
        fixCount += matches.length;
      }
    });

    if (fixCount > 0) {
      changes.push({ type: 'vietnamese_char_fix', count: fixCount });
    }

    return { text: result, changes };
  }

  _fixCoreVocabulary(text) {
    let result = text;
    const changes = [];
    let fixCount = 0;

    this.coreVocabulary.forEach(({ pattern, replacement }) => {
      const matches = result.match(pattern);
      if (matches) {
        result = result.replace(pattern, replacement);
        fixCount += matches.length;
      }
    });

    if (fixCount > 0) {
      changes.push({ type: 'core_vocabulary_fix', count: fixCount });
    }

    return { text: result, changes };
  }

  _applyLegalVocabulary(text) {
    let result = text;
    const changes = [];
    let totalFixes = 0;

    for (const [category, patterns] of Object.entries(this.legalVocabulary)) {
      let categoryFixes = 0;
      
      patterns.forEach(({ pattern, replacement }) => {
        const matches = result.match(pattern);
        if (matches) {
          result = result.replace(pattern, replacement);
          categoryFixes += matches.length;
        }
      });

      if (categoryFixes > 0) {
        changes.push({ 
          type: 'legal_vocabulary',
          category,
          count: categoryFixes
        });
        totalFixes += categoryFixes;
      }
    }

    return { text: result, changes };
  }

  _fixNumbersAndDates(text) {
    let result = text;
    const changes = [];

    // Vietnamese number formatting
    const before1 = result;
    result = result.replace(/\b(\d{1,3})(\d{3})(\d{3})\b/g, '$1.$2.$3');
    result = result.replace(/\b(\d{1,3})(\d{3})\b(?!\d)/g, '$1.$2');
    if (before1 !== result) {
      changes.push({ type: 'number_formatting' });
    }

    // Date formatting
    const before2 = result;
    result = result.replace(/(\d{1,2})[\/⁄\\.-](\d{1,2})[\/⁄\\.-](\d{4})/g, '$1/$2/$3');
    if (before2 !== result) {
      changes.push({ type: 'date_formatting' });
    }

    result = result.replace(/(\d)\s+([.,]\d)/g, '$1$2');
    result = result.replace(/(\d)([A-Za-zÀ-ỹ])/g, '$1 $2');

    return { text: result, changes };
  }

  _applyDocumentFormatting(text, docType) {
    let result = text;
    const changes = [];

    const formatRules = this.documentFormatting[docType] || 
                       this.documentFormatting[docType.split('_')[0]];

    if (!formatRules) {
      return { text: result, changes };
    }

    if (formatRules.articlePattern) {
      const before = result;
      result = result.replace(formatRules.articlePattern, formatRules.articleReplacement);
      if (before !== result) {
        changes.push({ type: 'article_formatting' });
      }
    }

    if (formatRules.sectionPatterns) {
      formatRules.sectionPatterns.forEach(({ pattern, replacement }) => {
        result = result.replace(pattern, replacement);
      });
    }

    if (formatRules.headers) {
      formatRules.headers.forEach(({ pattern, replacement }) => {
        result = result.replace(pattern, replacement);
      });
    }

    return { text: result, changes };
  }

  _finalCleanup(text) {
    return text
      .replace(/\s{2,}/g, ' ')
      .replace(/\n{4,}/g, '\n\n\n')
      .replace(/^\s+|\s+$/gm, '')
      .trim();
  }

  _calculateConfidence(original, cleaned, changes, docType) {
    const lengthDiff = Math.abs(original.length - cleaned.length);
    const changeRatio = lengthDiff / original.length;
    
    const changeScore = Math.max(0, 1 - (changeRatio * 2));
    
    const knownTypes = ['contract_lease', 'contract_employment', 'invoice', 'payment_request'];
    const typeScore = knownTypes.includes(docType) ? 1 : (docType !== 'unknown' ? 0.8 : 0.5);
    
    const changeTypeScore = Math.max(0, 1 - (changes.length * 0.02));
    
    const legalVocabChanges = changes.filter(c => c.type === 'legal_vocabulary').length;
    const vocabScore = Math.min(1, 0.7 + (legalVocabChanges * 0.03));
    
    const confidence = (
      changeScore * 0.30 + 
      typeScore * 0.35 + 
      changeTypeScore * 0.20 + 
      vocabScore * 0.15
    );
    
    return Math.round(confidence * 100) / 100;
  }

  _createMetadata(originalLength, cleanedLength, changesCount, docType) {
    return {
      originalLength,
      cleanedLength,
      changesCount,
      documentType: docType,
      reduction: originalLength > 0 
        ? Math.round(((originalLength - cleanedLength) / originalLength) * 100) 
        : 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Extract metadata from cleaned text
   */
  extractMetadata(cleanedText) {
    const docType = this._detectDocumentType(cleanedText);
    
    return {
      documentType: docType,
      dates: this._extractDates(cleanedText),
      parties: this._extractParties(cleanedText),
      amounts: this._extractAmounts(cleanedText),
      references: this._extractReferences(cleanedText),
      specific: this._extractDocumentSpecific(cleanedText, docType)
    };
  }

  _extractDates(text) {
    const dates = [];
    const datePattern = /(\d{1,2}\/\d{1,2}\/\d{4})/g;
    let match;
    while ((match = datePattern.exec(text)) !== null) {
      dates.push(match[1]);
    }
    return [...new Set(dates)];
  }

  _extractParties(text) {
    const parties = {};
    
    const benAMatch = text.match(/BÊN CHO THUÊ.*?(?=II\.|BÊN THUÊ|ĐIỀU)/is);
    if (benAMatch) {
      const companyMatch = benAMatch[0].match(/CÔNG TY[^\n]+/i);
      parties.benA = companyMatch ? companyMatch[0].trim() : null;
    }
    
    const benBMatch = text.match(/BÊN THUÊ.*?(?=ĐIỀU|Bên A và Bên B)/is);
    if (benBMatch) {
      const companyMatch = benBMatch[0].match(/Tên doanh nghiệp:\s*([^\n]+)/i);
      parties.benB = companyMatch ? companyMatch[1].trim() : null;
    }
    
    return parties;
  }

  _extractAmounts(text) {
    const amounts = [];
    const amountPattern = /(\d{1,3}(?:\.\d{3})*)\s*(?:đ|VNĐ|VND|đồng)/gi;
    let match;
    while ((match = amountPattern.exec(text)) !== null) {
      amounts.push(match[1]);
    }
    return [...new Set(amounts)];
  }

  _extractReferences(text) {
    const references = [];
    const legalPattern = /(?:Bộ luật|Luật|Nghị định|Thông tư)[^\n]+/gi;
    let match;
    while ((match = legalPattern.exec(text)) !== null) {
      references.push(match[0].trim());
    }
    return references;
  }

  _extractDocumentSpecific(text, docType) {
    const specific = {};

    switch(docType) {
      case 'contract_lease':
        specific.rentalPeriod = this._extract(text, /thời hạn thuê.*?(\d+.*?(?:tháng|năm))/i);
        specific.deposit = this._extract(text, /đặt cọc.*?([\d.]+)/i);
        break;
      
      case 'invoice':
        specific.invoiceNumber = this._extract(text, /số.*?hóa đơn:?\s*(\S+)/i);
        specific.taxCode = this._extract(text, /mã số thuế:?\s*(\d+)/i);
        break;
      
      case 'payment_request':
        specific.requestNumber = this._extract(text, /số:?\s*(\S+)/i);
        specific.department = this._extract(text, /bộ phận.*?(\d+_\w+)/i);
        break;
    }

    return specific;
  }

  _extract(text, pattern) {
    const match = text.match(pattern);
    return match ? match[1].trim() : null;
  }

  /**
   * Get vocabulary statistics
   */
  getStats() {
    const stats = {
      documentTypes: Object.keys(this.documentTypeSignatures).length,
      vocabularyCategories: Object.keys(this.legalVocabulary).length,
      totalPatterns: 0
    };

    for (const patterns of Object.values(this.legalVocabulary)) {
      stats.totalPatterns += patterns.length;
    }

    stats.totalPatterns += this.coreVocabulary.length;
    stats.totalPatterns += this.vietnameseCharFixes.length;

    return stats;
  }
}

export default VietnameseOCRCleaner;
