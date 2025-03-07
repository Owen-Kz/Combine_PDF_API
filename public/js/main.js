/*
 *
 * JS Script
 * @ThemeEaster
 */
(function($) {
    "use strict";

    $(window).on('load', function() {
        $('body').addClass('loaded');
    });

    $(document).ready(function() {

        /*=============================================================
        Header Activation
        ==============================================================*/
        var primaryHeader = $('.primary-header'),
            headerClone = primaryHeader.clone();
        $('.header').after('<div class="sticky-header"></div>');
        $('.sticky-header').append(headerClone);
        var headerSelector = document.querySelector(".sticky-header");
        var triggerPoint = $('.header').height();
        var yOffset = 0;

        $(window).on('scroll', function () {
            yOffset = $(window).scrollTop();
            if (yOffset >= triggerPoint) {
                $('.sticky-header').addClass('sticky-fixed-top');
            } else {
                $('.sticky-header').removeClass('sticky-fixed-top');
            }
        });

        if ($('.primary-header').length) {
            $('.header .primary-header .burger-menu').on("click", function () {
                $(this).toggleClass('menu-open');
                $('.header .header-menu-wrap').slideToggle(300);
            });

            $('.sticky-header .primary-header .burger-menu').on("click", function () {
                $(this).toggleClass('menu-open');
                $('.sticky-header .header-menu-wrap').slideToggle(300);
            });
        }

        $('.header-menu-wrap ul li:has(ul)').each(function () {
            $(this).append('<span class="dropdown-plus"></span>');
            $(this).addClass('dropdown_menu');
        });

        $('.header-menu-wrap .dropdown-plus').on("click", function () {
            $(this).prev('ul').slideToggle(300);
            $(this,).toggleClass('dropdown-open');
            $('.header-menu-wrap ul li:has(ul)').toggleClass('dropdown-open');
        });

        $('.header-menu-wrap .dropdown_menu a').append('<span></span>');

        // Responsive Classes
        function responsiveClasses() {
            var body = $('body');
            if ($(window).width() < 992) {
                body.removeClass('viewport-lg');
                body.addClass('viewport-sm');
            } else {
                body.removeClass('viewport-sm');
                body.addClass('viewport-lg');
            }
        }

        // Transparent Header
        function transparentHeader(){
            if($('body').hasClass('header-3')){
                var stickyHeader = $('.header-3 .header .header-logo'),
                    stickyHeaderLogo = stickyHeader.data('sticky-logo');
                if('' != stickyHeaderLogo){
                    $(".header-3 .sticky-header .header-logo img").attr('src',stickyHeaderLogo);
                }
            }
            var header = $('.header.header-three'),
                headerHeight = header.height(),
                pageHeader = $('.page-header');
            pageHeader.css('padding-top', headerHeight + 'px');
        }

        //responsiveClasses();
        $(window).on("resize", function () {
            responsiveClasses();
            transparentHeader();
        }).resize();

        /* ========== Popup Search Box ========== */
        $(function () {
            $('#dl-popup-search-box').removeClass('toggled');

            $('.dl-search-icon').on('click', function (e) {
                e.stopPropagation();
                $('#dl-popup-search-box').toggleClass('toggled');
                $("#popup-search").focus();
            });

            $('#dl-popup-search-box input').on('click', function (e) {
                e.stopPropagation();
            });

            $('#dl-popup-search-box, body').on('click', function () {
                $('#dl-popup-search-box').removeClass('toggled');
            });
        });

        // Header BTN Effect
        $('.header-btn').on('mouseenter', function (e) {
            var parentOffset = $(this).offset(),
                relX = e.pageX - parentOffset.left,
                relY = e.pageY - parentOffset.top;
            $(this).find('span').css({top: relY, left: relX})
        }).on('mouseout', function (e) {
            var parentOffset = $(this).offset(),
                relX = e.pageX - parentOffset.left,
                relY = e.pageY - parentOffset.top;
            $(this).find('span').css({top: relY, left: relX})
        });

        /*=============================================================
        Vanobox Activation
        ==============================================================*/
         $('.venobox').venobox({
             spinner: 'spinner-pulse',
         });

        /*=============================================================
        Scroll to Top
        ==============================================================*/
        var scrollTop = $("#scroll-top");
        $(window).on('scroll', function() {
            var topPos = $(this).scrollTop();
            if (topPos > 100) {
                $('#scrollup').removeClass('hide');
                $('#scrollup').addClass('show');

            } else {
                $('#scrollup').removeClass('show');
                $('#scrollup').addClass('hide');
            }
        });

        $(scrollTop).on("click", function() {
            $('html, body').animate({
                scrollTop: 0
            }, 800);
            return false;
        });

        /*=============================================================
        Main Slider
        ==============================================================*/
        $('#main-slider').on('init', function(e, slick) {
            var $firstAnimatingElements = $('div.single-slide:first-child').find('[data-animation]');
            doAnimations($firstAnimatingElements);
        });
        $('#main-slider').on('beforeChange', function(e, slick, currentSlide, nextSlide) {
                  var $animatingElements = $('div.single-slide[data-slick-index="' + nextSlide + '"]').find('[data-animation]');
                  doAnimations($animatingElements);
        });
        $('#main-slider').slick({
           autoplay: true,
           autoplaySpeed: 10000,
           dots: true,
           fade: true,
           prevArrow: '<div class="slick-prev"><i class="fa fa-chevron-left"></i></div>',
                nextArrow: '<div class="slick-next"><i class="fa fa-chevron-right"></i></div>'
        });
        function doAnimations(elements) {
            var animationEndEvents = 'webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend';
            elements.each(function() {
                var $this = $(this);
                var $animationDelay = $this.data('delay');
                var $animationDuration = $this.data('duration');
                var $animationType = 'animated ' + $this.data('animation');
                $this.css({
                    'animation-delay': $animationDelay,
                    '-webkit-animation-delay': $animationDelay,
                    'animation-duration': $animationDuration,
                    '-webkit-animation-duration': $animationDuration
                });
                $this.addClass($animationType+' element').one(animationEndEvents, function() {
                    $this.removeClass($animationType);
                });
            });
        }

        /*=============================================================
        Odometer
        ==============================================================*/
        $('.odometer').waypoint(
            function() {
                var odo = $(".odometer");
                odo.each(function() {
                    var countNumber = $(this).attr("data-count");
                    $(this).html(countNumber);
                });
            }, {
                offset: "80%",
                triggerOnce: true
            }
        );

        /*=============================================================
        Hover Effect
        ==============================================================*/
        $(' .service-items .service-item, .project-carousel .project-item, .portfolio-items .portfolio-item, .project-items .project-item').each(function() {
            $(this).hoverdir();
        });

        /*=============================================================
        Team Hover Effect
        ==============================================================*/
        $('.team-items .team-item').each(function() {
            $(this).on('mouseenter', function() {
                if ($(this).data('name')) {
                    $('.team-info').html('<span class="name reveal-text-2">' + $(this).data('name') + '</span>' + '<span class="position reveal-text-2">' + $(this).data('position') + '</span>');
                    $('.team-info').addClass('visible');
                }

                $(document).on('mousemove', function(e) {
                    $('.team-info').css({
                        left: e.clientX - 10,
                        top: e.clientY + 25
                    });
                });
            }).on('mouseleave', function() {
                $('.team-info').removeClass('visible');
            });
        });

        /*=============================================================
        WOW JS Active
        ==============================================================*/
        new WOW().init();

        /*=============================================================
        Splitting JS Active
        ==============================================================*/
        Splitting();

        /*=============================================================
        Nice Select JS Active
        ==============================================================*/
        $('select').niceSelect();

        /*=============================================================
        Project Carousel
        ==============================================================*/
        $('.project-carousel').slick({
            dots: true,
            infinite: false,
            speed: 300,
            slidesToShow: 4,
            slidesToScroll: 1,
            prevArrow: '<i class="las la-arrow-left left"></i>',
            nextArrow: '<i class="las la-arrow-right right"></i></i>',
            infinite: true,
            dots: true,
            pauseOnFocus: false,
            pauseOnHover: true,
            responsive: [{
                    breakpoint: 1024,
                    settings: {
                        slidesToShow: 3,
                    }
                },
                {
                    breakpoint: 767,
                    settings: {
                        slidesToShow: 2,
                    }
                },
                {
                    breakpoint: 580,
                    settings: {
                        slidesToShow: 1,
                    }
                }
            ]
        });

        /*=============================================================
        Project Details
        ==============================================================*/
        $('.project-details-carousel').slick({
            dots: false,
            infinite: false,
            speed: 300,
            slidesToShow: 1,
            slidesToScroll: 1,
            prevArrow: '<i class="las la-arrow-left left"></i>',
            nextArrow: '<i class="las la-arrow-right right"></i></i>',
            infinite: true,
            dots: false,
            pauseOnFocus: false,
            pauseOnHover: true,
            responsive: [{
                    breakpoint: 1024,
                    settings: {
                        slidesToShow: 1,
                    }
                },
                {
                    breakpoint: 767,
                    settings: {
                        slidesToShow: 1,
                    }
                },
                {
                    breakpoint: 580,
                    settings: {
                        slidesToShow: 1,
                    }
                }
            ]
        });

        /*=============================================================
        ISOTOP Active
        ==============================================================*/
        $('.portfolio-items').imagesLoaded( function() {

             // Add isotope click function
            $('.portfolio-filter li').on( 'click', function(){
                $(".portfolio-filter li").removeClass("active");
                $(this).addClass("active");

                var selector = $(this).attr('data-filter');
                $(".portfolio-items").isotope({
                    filter: selector,
                    animationOptions: {
                        duration: 750,
                        easing: 'linear',
                        queue: false,
                    }
                });
                return false;
            });

            $(".portfolio-items").isotope({
                itemSelector: '.single-item',
                layoutMode: 'masonry',
            });
        });

        /*=============================================================
        Testimonial Carousel
        ==============================================================*/
        $('.testimonials-carousel').slick({
            dots: true,
            infinite: false,
            speed: 300,
            slidesToShow: 3,
            slidesToScroll: 1,
            prevArrow: '<i class="las la-arrow-left left"></i>',
            nextArrow: '<i class="las la-arrow-right right"></i></i>',
            infinite: true,
            dots: true,
            pauseOnFocus: false,
            pauseOnHover: true,
            responsive: [{
                    breakpoint: 1024,
                    settings: {
                        slidesToShow: 2,
                    }
                },
                {
                    breakpoint: 767,
                    settings: {
                        slidesToShow: 2,
                    }
                },
                {
                    breakpoint: 580,
                    settings: {
                        slidesToShow: 1,
                    }
                }
            ]
        });

        /*=============================================================
        Testimonial Carousel 02
        ==============================================================*/
       $('.testimonials-carousel-2').slick({
            dots: true,
            infinite: false,
            speed: 300,
            slidesToShow: 2,
            slidesToScroll: 1,
            prevArrow: '<i class="las la-arrow-left left"></i>',
            nextArrow: '<i class="las la-arrow-right right"></i></i>',
            infinite: true,
            dots: true,
            pauseOnFocus: false,
            pauseOnHover: true,
            responsive: [{
                    breakpoint: 1024,
                    settings: {
                        slidesToShow: 2,
                    }
                },
                {
                    breakpoint: 992,
                    settings: {
                        slidesToShow: 1,
                    }
                },
                {
                    breakpoint: 580,
                    settings: {
                        slidesToShow: 1,
                    }
                }
            ]
        });

        /*=============================================================
        Testimonial Carousel 03
        ==============================================================*/
       $('.testimonials-carousel-3').slick({
            dots: true,
            infinite: false,
            speed: 300,
            slidesToShow: 1,
            slidesToScroll: 1,
           arrows: false,
            infinite: true,
            dots: true,
            pauseOnFocus: false,
            pauseOnHover: true,
        });

        // Custom carousel nav
        $('.testi-controls .prev').on( 'click', function(){
            $('.testimonials-carousel-3').slick('slickPrev');
        });

        $('.testi-controls .next').on( 'click', function(e){
            e.preventDefault();
            $('.testimonials-carousel-3').slick('slickNext');
        });

        /*=============================================================
        Sponsor Carousel
        ==============================================================*/
        $('.sponsor-carousel').slick({
            speed: 300,
            slidesToShow: 6,
            slidesToScroll: 1,
            autoplay: true,
            infinite: true,
            dots: false,
            arrows: true,
            prevArrow: '<i class="las la-arrow-left left"></i>',
            nextArrow: '<i class="las la-arrow-right right"></i></i>',
            loop: true,
            pauseOnFocus: false,
            pauseOnHover: true,
            responsive: [{
                    breakpoint: 1024,
                    settings: {
                        slidesToShow: 4,
                    }
                },
                {
                    breakpoint: 767,
                    settings: {
                        slidesToShow: 4,
                    }
                },
                {
                    breakpoint: 580,
                    settings: {
                        slidesToShow: 3,
                    }
                }
            ]
        });

        /*=============================================================
        Subscribe Mailchimp
        ==============================================================*/
        if ($('.subscribe_form').length > 0) {
            /*  MAILCHIMP  */
            $('.subscribe_form').ajaxChimp({
                language: 'es',
                callback: mailchimpCallback,
                url: "//alexatheme.us14.list-manage.com/subscribe/post?u=48e55a88ece7641124b31a029&amp;id=361ec5b369"
            });
        }

        function mailchimpCallback(resp) {
            if (resp.result === 'success') {
                $('#subscribe-result').addClass('subs-result');
                $('.subscription-success').text(resp.msg).fadeIn();
                $('.subscription-error').fadeOut();

            } else if (resp.result === 'error') {
                $('#subscribe-result').addClass('subs-result');
                $('.subscription-error').text(resp.msg).fadeIn();
            }
        }
        $.ajaxChimp.translations.es = {
            'submit': 'Submitting...',
            0: 'We have sent you a confirmation email',
            1: 'Please enter your email',
            2: 'An email address must contain a single @',
            3: 'The domain portion of the email address is invalid (the portion after the @: )',
            4: 'The username portion of the email address is invalid (the portion before the @: )',
            5: 'This email address looks fake or invalid. Please enter a real email address'
        };

        /*===== Copyright =====*/
        var currentYear  = new Date().getFullYear();
        $('#currentYear').append(currentYear);

    });

})(jQuery);