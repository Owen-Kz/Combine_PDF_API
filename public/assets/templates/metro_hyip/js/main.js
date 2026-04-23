(function ($) {
  "use strict";
  //============= header button hide js start here =============
  $('.header-button').on('click', function() {
    $('.body-overlay').toggleClass('show')
  }); 
  $('.body-overlay').on('click', function() {
    $('.header-button').trigger('click')
    $(this).removeClass('show');
  }); 
  // =============== Header Hide Click On Body Js End =========
  // ==========================================
  //      Start Document Ready function
  // ==========================================
  $(document).ready(function () {

  // ========================== Header Hide Scroll Bar Js Start =====================
    $('.navbar-toggler.header-button').on('click', function() {
      $('body').toggleClass('scroll-hidden-sm')
    }); 
    $('.body-overlay').on('click', function() {
      $('body').removeClass('scroll-hidden-sm')
    }); 
  // ========================== Header Hide Scroll Bar Js End =====================
    
    // ================== Password Show Hide Js Start ==========
    $(".toggle-password").on('click', function() {
      $(this).toggleClass(" fa-eye-slash");
      var input = $($(this).attr("id"));
      if (input.attr("type") == "password") {
      input.attr("type", "text");
      } else {
      input.attr("type", "password");
      }
    });
  // =============== Password Show Hide Js End =================
    
  // ============================ToolTip Js Start=====================
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))  
  // ============================ToolTip Js End========================
    
  
     // ================== Sidebar Menu Js Start ===============
    // Sidebar Dropdown Menu Start
    $(".has-dropdown > a").click(function() {
      $(".sidebar-submenu").slideUp(200);
      if (
        $(this)
          .parent()
          .hasClass("active")
      ) {
        $(".has-dropdown").removeClass("active");
        $(this)
          .parent()
          .removeClass("active");
      } else {
        $(".has-dropdown").removeClass("active");
        $(this)
          .next(".sidebar-submenu")
          .slideDown(200);
        $(this)
          .parent()
          .addClass("active");
      }
    });
    //==================== Sidebar Dropdown Menu End================

  // ====================Sidebar Icon & Overlay js ================
    $(".dashboard-body__bar-icon").on("click", function() {
      $(".sidebar-menu").addClass('show-sidebar'); 
      $(".sidebar-overlay").addClass('show'); 
    });
    $(".sidebar-menu__close, .sidebar-overlay").on("click", function() {
      $(".sidebar-menu").removeClass('show-sidebar'); 
      $(".sidebar-overlay").removeClass('show'); 
    });
    // Sidebar Icon & Overlay js 
  // ===================== Sidebar Menu Js End =================

  // ==================== Dashboard User Profile Dropdown Start ==================
  $('.user-info__button').on('click', function() {
    $('.user-info-dropdown').toggleClass('show'); 
  }); 
  
  $('.user-info__button').attr('tabindex', -1).focus();  

  $('.user-info__button').on('focusout', function() {
    $('.user-info-dropdown').removeClass('show'); 
  }); 
  // ==================== Dashboard User Profile Dropdown End ==================
 
  
});
  
  // ========================= Preloader Js Start =====================
    $(window).on("load", function(){
      $('.preloader').fadeOut(); 
    })
    // ========================= Preloader Js End=====================

    // ========================= Header Sticky Js Start ==============
    $(window).on('scroll', function() {
      if ($(window).scrollTop() >= 300) {
        $('.header').addClass('fixed-header');
      }
      else {
          $('.header').removeClass('fixed-header');
      }
    }); 
    // ========================= Header Sticky Js End===================
    
    //============================ Scroll To Top Icon Js Start =========
    var btn = $('.scroll-top');

    $(window).scroll(function() {
      if ($(window).scrollTop() > 300) {
        btn.addClass('show');
      } else {
        btn.removeClass('show');
      }
    });

    btn.on('click', function(e) {
      e.preventDefault();
      $('html, body').animate({scrollTop:0}, '300');
    });
//========================= Scroll To Top Icon Js End ======================

})(jQuery);