import Swal from 'sweetalert2';

// 封裝共用的 SweetAlert2 確認視窗
export const confirmAction = async ({ title, text, confirmButtonText = '確定', confirmButtonColor = '#ff6b6b' }) => {
  return await Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText: '取消',
    confirmButtonColor,
    background: '#1a1a2e',
    color: '#fff'
  });
};

export const showSuccess = (title, text = '') => {
  Swal.fire({
    title,
    text,
    icon: 'success',
    background: '#1a1a2e',
    color: '#fff',
    timer: 1500,
    showConfirmButton: false
  });
};

export const showError = (title, text = '') => {
  Swal.fire({
    title,
    text,
    icon: 'error',
    background: '#1a1a2e',
    color: '#fff'
  });
};
