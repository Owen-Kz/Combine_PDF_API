document.addEventListener('DOMContentLoaded', function () {
    console.log('DOMContentLoaded event fired');
    const whyItems = document.querySelectorAll('.why-item');

    function checkSlide() {
        whyItems.forEach((whyItem, index) => {
            const slideInAt = (window.scrollY + window.innerHeight) - whyItem.clientHeight / 2;
            const whyItemBottom = whyItem.offsetTop + whyItem.clientHeight;
            const isHalfShown = slideInAt > whyItem.offsetTop;
            const isNotScrolledPast = window.scrollY < whyItemBottom;

            if (isHalfShown && isNotScrolledPast) {
                whyItem.style.opacity = '1';
                whyItem.style.transform = 'translateY(0)';
            }
        });
    }

    window.addEventListener('scroll', checkSlide);
});




let prevScrollpos = window.pageYOffset;
if(document.getElementById("header")){
window.onscroll = function() {
    let currentScrollPos = window.pageYOffset;
    if (prevScrollpos > currentScrollPos) {
        document.getElementById("header").style.top = "0"; /* Show the header when scrolling up */
    } else {
        document.getElementById("header").style.top = "-100%"; /* Hide the header when scrolling down */
    }
    prevScrollpos = currentScrollPos;
}
}

$(document).ready(function() {
    $(".mobile-menu-icon").click(function() {
        $(".mobile-body").css("display", "flex");

        // Toggle the 'active' class to change the icon to an "X"
        $(this).toggleClass('active');

        // Adjusted the positions to slide in and out from the right
        $(".mobile-menu-container").css("right", "0");
        $(".mobile-body").css("right", "0");
    });

    $(".mobile-menu-container").click(function(e) {
        if (e.target === this) {
            // Adjusted the positions to slide out to the right
            $(this).css("right", "-80%");
            $(".mobile-body").css("right", "-100%");

            // Remove the 'active' class to change the icon back to the burger
            $(".mobile-menu-icon").removeClass('active');

            // Used hide() instead of setting display to none
            $(".mobile-body").hide();
        }
    });

    $(".mobile-body").click(function(e) {
        if (e.target === this) {
            // Adjusted the positions to slide out to the right
            $(this).css("right", "-100%");

            // Remove the 'active' class to change the icon back to the burger
            $(".mobile-menu-icon").removeClass('active');

            // Used hide() instead of setting display to none
            $(this).hide();
        }
    });


    $(".close-mobile-menu").click(function(e) {
        if (e.target === this) {
            // Adjusted the positions to slide out to the right
            $(".mobile-body").css("right", "-100%");

            // Remove the 'active' class to change the icon back to the burger
            $(".mobile-menu-icon").removeClass('active');

            // Used hide() instead of setting display to none
            $(".mobile-body").hide();
        }
    });

});


document.addEventListener("DOMContentLoaded", function() {
    const articles = document.querySelectorAll(".article-container");
    let currentArticle = 0;
    const totalArticles = articles.length;

    function showArticle(index) {
        // Hide all articles
        articles.forEach(article => {
            article.style.transform = `translateX(-${index * 100}%)`;
        });
    }

    function nextArticle() {
        currentArticle = (currentArticle + 1) % totalArticles;
        showArticle(currentArticle);
    }

    // Interval for automatic sliding
    const interval = setInterval(nextArticle, 8000); // Adjust the interval as needed


    // Show the initial article
    showArticle(currentArticle);
});





// document.addEventListener("DOMContentLoaded", function() {
//     const carousel = document.querySelector('.recent-events-carousel');
//     const items = document.querySelectorAll('.recent-events-items');
//     const dotsContainer = document.querySelector('.recent-events-carousel-dots');
//     let currentIndex = 0;
//     let intervalId;

//     if(carousel){
//     // Function to move carousel
//     function moveCarousel() {
//         const itemWidth = items[0].offsetWidth;
//         const offset = -currentIndex * (itemWidth + (itemWidth * 0.1));
//         carousel.style.transform = `translateX(${offset}px)`;
//     }

//     // Function to create dots for navigation
//     function createDots() {
//         items.forEach((_, index) => {
//             const dot = document.createElement('span');
//             dot.classList.add('recent-events-dot');
//             if (index === currentIndex) dot.classList.add('active-recent-dot');
//             dot.addEventListener('click', () => {
//                 slideTo(index);
//             });
//             dotsContainer.appendChild(dot);
//         });
//     }

//     // Function to handle sliding
//     function slideTo(index) {
//         if (index < 0 || index >= items.length) return;
//         currentIndex = index;
//         moveCarousel();
//         updateDots();
//     }

//     // Function to update active dot
//     function updateDots() {
//         const dots = document.querySelectorAll('.recent-events-dot');
//         dots.forEach((dot, index) => {
//             if (index === currentIndex) {
//                 dot.classList.add('active-recent-dot');
//             } else {
//                 dot.classList.remove('active-recent-dot');
//             }
//         });
//     }

//     // Function to automatically slide
//     function autoSlide() {
//         intervalId = setInterval(() => {
//             slideTo(currentIndex + 1);
//         }, 5000); // Change the time interval as needed (5000ms = 5 seconds)
//     }

//     // Stop auto sliding when mouse is over carousel
//     carousel.addEventListener('mouseover', () => {
//         clearInterval(intervalId);
//     });

//     // Resume auto sliding when mouse leaves carousel
//     carousel.addEventListener('mouseleave', () => {
//         autoSlide();
//     });

//     // Initial setup
//     createDots();
//     moveCarousel();
//     autoSlide();

//     // Listen for arrow key presses
//     document.addEventListener('keydown', function(e) {
//         if (e.key === 'ArrowRight') {
//             slideTo(currentIndex + 1);
//         } else if (e.key === 'ArrowLeft') {
//             slideTo(currentIndex - 1);
//         }
//     });
// }
// });




function setActive(event, index) {
    
    const navItems = document.querySelectorAll('.author-submit-nav li');
    navItems.forEach(item => item.classList.remove('active')); // Remove active class from all items
    navItems[index].classList.add('active'); // Add active class to clicked item

    //  // Smooth scroll to the target element
    //  target.scrollIntoView({
    //     top: currentScroll + targetPosition - offset,
    //     behavior: 'smooth',
    //     block: 'start'
    // });

 
}
