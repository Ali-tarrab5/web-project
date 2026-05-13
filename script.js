function toggleMenu() {
    const navLinks = document.querySelector('.nav-links');
    navLinks.classList.toggle('active');
}


const navLinks = document.querySelectorAll('.nav-links a');
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        const menu = document.querySelector('.nav-links');
        menu.classList.remove('active');
    });
});

$(document).ready(function(){
    console.log('Document ready, initializing Slick');
    $('.feature-grid').slick({
        infinite: true,
        slidesToShow: 3,
        slidesToScroll: 1,
        autoplay: true,
        autoplaySpeed: 5000,
        pauseOnHover: false,  // Disable default pause on hover
        prevArrow: '.prev-btn',
        nextArrow: '.next-btn',
        responsive: [
            {
                breakpoint: 768,
                settings: {
                    slidesToShow: 2
                }
            },
            {
                breakpoint: 480,
                settings: {
                    slidesToShow: 1
                }
            }
        ]
    });
    console.log('Slick initialized');

    // AI-Enhanced: Pause autoplay only on hover over product cards
    $('.feature-card').on('mouseenter', function() {
        $('.feature-grid').slick('slickPause');
        console.log('Autoplay paused on card hover');
    });

    $('.feature-card').on('mouseleave', function() {
        $('.feature-grid').slick('slickPlay');
        console.log('Autoplay resumed on card leave');
    });

    // Update counter
    $('.feature-grid').on('afterChange', function(event, slick, currentSlide){
        var totalSlides = slick.slideCount;
        $('.slide-counter').text('Showing ' + (currentSlide + 1) + ' of ' + totalSlides);
    });

    // Initial counter
    var slickInstance = $('.feature-grid').slick('getSlick');
    var initialTotal = slickInstance.slideCount;
    $('.slide-counter').text('Showing 1 of ' + initialTotal);
    console.log('Initial counter set to: ' + initialTotal);
});
